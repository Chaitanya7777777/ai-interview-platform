"""
ai_service.py
-------------
Abstraction layer for all Groq API calls.

Responsibilities
----------------
- Hold a single shared Groq client (configured from settings).
- Run synchronous Groq calls in a thread pool (asyncio.to_thread) so
  the async event loop is never blocked.
- Strip markdown code fences from responses before JSON parsing.
- Validate raw AI text against Pydantic schemas.
- Provide a structured fallback when Groq returns malformed JSON.
- Apply a configurable timeout so a stuck Groq call never hangs forever.
- Expose one clean public method per AI feature.

AI flow for resume analysis
----------------------------
1. load_prompt_template("resume_analysis.txt")   → prompt text from file
2. .format(resume_text=...)                       → inject resume content
3. asyncio.to_thread(_generate_text_sync)         → call Groq (non-blocking)
4. _extract_json()                                → strip code fences
5. ResumeAnalysisResponse.model_validate_json()   → Pydantic validation
6. On ValidationError → return _fallback_analysis() with HTTP 200 + warning
7. On timeout / Groq error → raise HTTP 503

Only this file may import or call groq.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TypeVar

from groq import Groq
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.schemas.ai import (
    InterviewFeedbackResponse,
    InterviewQuestionSet,
    ResumeAnalysisResponse,
)
from app.utils.prompt_loader import load_prompt_template

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# How long (seconds) to wait for a Groq response before giving up.
GROQ_TIMEOUT_SECONDS: float = 60.0


class AIService:
    """
    Singleton-style service for all Groq interactions.

    Instantiated once at module level as `ai_service`.
    """

    def __init__(self) -> None:
        self._client = (
            Groq(api_key=settings.groq_api_key)
            if settings.groq_api_key
            else None
        )

    # ── Private: client guard ─────────────────────────────────────────────────

    def _ensure_client(self) -> Groq:
        """Raise a RuntimeError if the Groq API key was not configured."""
        if self._client is None:
            raise RuntimeError(
                "GROQ_API_KEY is not configured. "
                "Add it to your .env file and restart the server."
            )
        return self._client

    # ── Private: response cleaning ────────────────────────────────────────────

    @staticmethod
    def _extract_json(text: str) -> str:
        """
        Strip markdown code fences that Groq sometimes wraps around JSON.

        Handles patterns like:
            ```json { ... } ```
            ``` { ... } ```
            { ... }   ← already clean, returned as-is
        """
        stripped = text.strip()

        if stripped.startswith("```"):
            # Remove opening fence (```json or ```)
            stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
            # Remove closing fence
            stripped = re.sub(r"\s*```$", "", stripped)

        return stripped.strip()

    # ── Private: validation ───────────────────────────────────────────────────

    @staticmethod
    def _validate_response(raw_text: str, schema: type[T]) -> T:
        """
        Parse and validate the raw Groq response text against a Pydantic schema.

        Raises ValidationError if the JSON does not match the schema.
        Raises json.JSONDecodeError if the text is not valid JSON at all.
        """
        cleaned = AIService._extract_json(raw_text)
        return schema.model_validate_json(cleaned)

    # ── Private: synchronous Groq call (runs in thread pool) ───────────────

    def _generate_text_sync(self, prompt: str) -> str:
        """
        Synchronous Groq call.

        This is intentionally *not* async — it is called via asyncio.to_thread
        so the event loop stays free while waiting for the network.
        """
        client = self._ensure_client()
        message = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            temperature=0.7,
        )

        if not message.choices or not message.choices[0].message.content:
            raise RuntimeError("Groq returned an empty response.")

        return message.choices[0].message.content

    # ── Private: async orchestration with timeout ─────────────────────────────

    async def _generate_structured_response(
        self,
        prompt: str,
        schema: type[T],
    ) -> T:
        """
        Run the synchronous Groq call in a thread, apply timeout, validate.

        Raises
        ------
        asyncio.TimeoutError  : Groq did not respond within GROQ_TIMEOUT_SECONDS.
        RuntimeError          : Groq returned empty text.
        ValidationError       : Groq response did not match the expected schema.
        """
        raw_text = await asyncio.wait_for(
            asyncio.to_thread(self._generate_text_sync, prompt),
            timeout=GROQ_TIMEOUT_SECONDS,
        )
        return self._validate_response(raw_text, schema)

    # ── Private: resume analysis fallback ────────────────────────────────────

    @staticmethod
    def _fallback_analysis(reason: str) -> ResumeAnalysisResponse:
        """
        Return a safe placeholder ResumeAnalysisResponse when Groq's output
        cannot be parsed.

        The route layer logs the original error; this keeps the API from
        returning a 500 for a transient AI formatting issue.
        """
        return ResumeAnalysisResponse(
            overall_score=0,
            strengths=["Could not extract strengths — please try again."],
            weaknesses=["Analysis unavailable due to an AI formatting error."],
            missing_skills=["Analysis unavailable — please retry."],
            recommended_roles=["Analysis unavailable — please retry."],
            improvement_suggestions=[
                f"The AI analysis could not be parsed. Reason: {reason}. "
                "Please re-upload your resume and try again."
            ],
        )

    # ── Public: resume analysis ───────────────────────────────────────────────

    async def analyze_resume(
        self,
        resume_text: str,
    ) -> tuple[ResumeAnalysisResponse, bool]:
        """
        Analyse a resume and return a structured result.

        Parameters
        ----------
        resume_text : Plain text extracted from the uploaded resume file.

        Returns
        -------
        (ResumeAnalysisResponse, is_fallback)
            is_fallback is True when the result was produced by the fallback
            handler (i.e. Groq returned malformed JSON).

        Raises
        ------
        RuntimeError          : GROQ_API_KEY not configured.
        asyncio.TimeoutError  : Groq took longer than GROQ_TIMEOUT_SECONDS.
        """
        prompt = load_prompt_template("resume_analysis.txt").format(
            resume_text=resume_text
        )

        try:
            result = await self._generate_structured_response(
                prompt, ResumeAnalysisResponse
            )
            return result, False

        except (ValidationError, json.JSONDecodeError, ValueError) as exc:
            # Groq responded but the JSON was malformed or didn't match schema.
            logger.warning(
                "ResumeAnalysisResponse validation failed — using fallback. "
                "Error: %s",
                exc,
            )
            return self._fallback_analysis(str(exc)), True

        except Exception as exc:
            # Groq returned an error or other unexpected issue
            # Re-raise so resume_service can convert it to the right HTTP status code.
            logger.error("Groq error during resume analysis: %s", exc)
            raise

    # ── Public: interview questions ───────────────────────────────────────────

    async def generate_interview_questions(
        self,
        candidate_context: str,
        role_focus: str,
        difficulty: str,
    ) -> InterviewQuestionSet:
        prompt = load_prompt_template("interview_questions.txt").format(
            candidate_context=candidate_context,
            role_focus=role_focus,
            difficulty=difficulty,
        )
        return await self._generate_structured_response(prompt, InterviewQuestionSet)

    # ── Public: interview feedback ────────────────────────────────────────────

    async def generate_interview_feedback(
        self,
        transcript: list[dict[str, str]],
    ) -> InterviewFeedbackResponse:
        transcript_json = json.dumps(transcript, ensure_ascii=False, indent=2)
        prompt = load_prompt_template("interview_feedback.txt").format(
            transcript=transcript_json
        )
        return await self._generate_structured_response(prompt, InterviewFeedbackResponse)


# ── Module-level singleton ────────────────────────────────────────────────────

ai_service = AIService()
