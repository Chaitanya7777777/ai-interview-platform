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
2. _safe_format(template, ...)                    → inject user content safely
3. asyncio.to_thread(_generate_text_sync)         → call Groq (non-blocking)
4. clean_json_response()                          → strip code fences + prose
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
    JobMatchAnalysisResponse,
    QuestionEvaluationResponse,
    ResumeAnalysisResponse,
)
from app.utils.prompt_loader import load_prompt_template

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# How long (seconds) to wait for a Groq response before giving up.
GROQ_TIMEOUT_SECONDS: float = 60.0


# ── Module-level reusable helper ──────────────────────────────────────────────

def clean_json_response(text: str) -> str:
    """
    Robustly extract a JSON object from a raw LLM response.

    Handles all common Groq/LLM output patterns:
      1. Clean JSON:               { ... }
      2. Markdown fenced:          ```json\n{ ... }\n```
      3. JSON inside prose:        "Here is the result:\n{ ... }"
      4. Trailing explanation:     { ... }\nHope this helps!
      5. Nested/double fences:     ```\n```json\n{ ... }\n```\n```

    Returns the isolated JSON object string, ready for json.loads().
    """
    if not text or not text.strip():
        return "{}"

    stripped = text.strip()

    # ── Step 1: Remove ALL markdown code fences ──────────────────────────────
    # Pattern matches opening ```json, ```JSON, ``` and closing ```
    # We replace them with empty string to expose the raw JSON.
    if "```" in stripped:
        # Remove opening fence with optional language specifier (```json, ```JSON, etc.)
        stripped = re.sub(r"```[a-zA-Z]*\s*", "", stripped)
        # Remove any remaining bare closing fence markers
        stripped = stripped.replace("```", "")
        stripped = stripped.strip()

    # ── Step 2: Isolate the outermost JSON object { ... } ────────────────────
    # This handles preamble prose ("Here is your JSON:") and
    # trailing prose ("I hope this helps!").
    start = stripped.find("{")
    if start == -1:
        # No JSON object found — return as-is and let json.loads raise a clear error
        logger.warning("clean_json_response: no '{' found in AI response")
        return stripped.strip()

    # Walk backward from the end to find the last closing brace
    end = stripped.rfind("}")
    if end == -1 or end < start:
        logger.warning("clean_json_response: no matching '}' found in AI response")
        return stripped.strip()

    return stripped[start : end + 1].strip()


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
        Delegate to the module-level clean_json_response() helper.

        Kept for backward compatibility with any internal callers.
        """
        return clean_json_response(text)

    # ── Private: validation ───────────────────────────────────────────────────

    @staticmethod
    def _validate_response(raw_text: str, schema: type[T]) -> T:
        """
        Parse and validate the raw Groq response text against a Pydantic schema.

        Structured debug logging is emitted at each stage so the exact failure
        point is always visible in server logs.

        Raises ValidationError if the JSON does not match the schema.
        Raises json.JSONDecodeError if the text is not valid JSON at all.
        """
        # ── DEBUG: log raw AI response ────────────────────────────────────────
        logger.debug(
            "[AI DEBUG] Raw response for schema=%s (first 800 chars):\n%s",
            schema.__name__,
            raw_text[:800],
        )

        cleaned = AIService._extract_json(raw_text)

        # ── DEBUG: log cleaned response ───────────────────────────────────────
        logger.debug(
            "[AI DEBUG] Cleaned JSON for schema=%s (first 800 chars):\n%s",
            schema.__name__,
            cleaned[:800],
        )

        # ── Step 1: Validate JSON syntax ──────────────────────────────────────
        try:
            parsed_dict = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error(
                "[AI ERROR] JSON parse failed for schema=%s\n"
                "  JSONDecodeError: %s\n"
                "  Raw text   (first 500): %s\n"
                "  Cleaned text (first 500): %s",
                schema.__name__,
                exc,
                raw_text[:500],
                cleaned[:500],
            )
            raise

        # ── DEBUG: log parsed dict keys ───────────────────────────────────────
        logger.debug(
            "[AI DEBUG] Parsed JSON keys for schema=%s: %s",
            schema.__name__,
            list(parsed_dict.keys()) if isinstance(parsed_dict, dict) else type(parsed_dict).__name__,
        )

        # ── Step 2: Validate against Pydantic schema ──────────────────────────
        try:
            return schema.model_validate(parsed_dict)
        except ValidationError as exc:
            logger.error(
                "[AI ERROR] Pydantic validation failed for schema=%s\n"
                "  ValidationError: %s\n"
                "  Parsed dict: %s",
                schema.__name__,
                exc,
                str(parsed_dict)[:500],
            )
            raise

    # ── Private: safe prompt formatting ──────────────────────────────────────

    @staticmethod
    def _safe_format(template: str, **kwargs: str) -> str:
        """
        Format a prompt template, safely escaping any literal { } in the values
        so they don't interfere with str.format().

        Use this when injecting user content (resume text, answers) that may
        contain curly braces.
        """
        safe_kwargs = {
            k: v.replace("{", "{{").replace("}", "}}") if isinstance(v, str) else v
            for k, v in kwargs.items()
        }
        return template.format(**safe_kwargs)

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
        template = load_prompt_template("resume_analysis.txt")
        # Use _safe_format so { } in resume text don't crash str.format()
        prompt = self._safe_format(template, resume_text=resume_text)

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
        """
        Generate 7 interview questions tailored to the candidate's resume and role.

        Uses _safe_format() so curly braces inside resume text (code snippets,
        JSON fields, template strings, etc.) do not crash str.format().

        Raises
        ------
        ValueError        : AI returned a response that cannot be parsed after retries.
        RuntimeError      : GROQ_API_KEY not set.
        asyncio.TimeoutError : Groq took longer than GROQ_TIMEOUT_SECONDS.
        """
        template = load_prompt_template("interview_questions.txt")

        # CRITICAL FIX: use _safe_format so { } in resume text don't cause KeyError
        try:
            prompt = self._safe_format(
                template,
                candidate_context=candidate_context,
                role_focus=role_focus,
                difficulty=difficulty,
            )
        except KeyError as exc:
            # This should never happen with _safe_format, but guard defensively
            logger.error(
                "[AI ERROR] Prompt formatting failed for interview_questions.txt: %s"
                " — candidate_context length=%d, role_focus=%r, difficulty=%r",
                exc,
                len(candidate_context),
                role_focus,
                difficulty,
            )
            raise ValueError(
                f"Failed to build interview question prompt: {exc}. "
                "This is a server configuration error."
            ) from exc

        logger.debug(
            "[AI DEBUG] Interview question prompt built (first 300 chars):\n%s",
            prompt[:300],
        )

        try:
            result = await self._generate_structured_response(prompt, InterviewQuestionSet)
        except (ValidationError, json.JSONDecodeError) as exc:
            # AI responded but JSON was malformed — log and raise a clean ValueError
            # so the route can return a meaningful 503 without exposing a traceback.
            logger.error(
                "[AI ERROR] InterviewQuestionSet validation failed.\n"
                "  Error type: %s\n"
                "  Error: %s",
                type(exc).__name__,
                exc,
            )
            raise ValueError(
                f"AI returned malformed interview questions ({type(exc).__name__}). "
                "Please try again."
            ) from exc

        if not result.questions:
            logger.error("[AI ERROR] InterviewQuestionSet parsed successfully but questions list is empty.")
            raise ValueError("AI returned an empty question list. Please try again.")

        logger.info(
            "[AI] Generated %d interview questions for role=%r difficulty=%r",
            len(result.questions),
            role_focus,
            difficulty,
        )
        return result

    # ── Public: interview feedback ────────────────────────────────────────────

    async def generate_interview_feedback(
        self,
        transcript: list[dict[str, str]],
    ) -> InterviewFeedbackResponse:
        transcript_json = json.dumps(transcript, ensure_ascii=False, indent=2)
        template = load_prompt_template("interview_feedback.txt")
        # Use _safe_format so { } in user answers don't crash str.format()
        prompt = self._safe_format(template, transcript=transcript_json)
        return await self._generate_structured_response(prompt, InterviewFeedbackResponse)

    # ── Public: per-question evaluation ──────────────────────────────────────

    async def evaluate_question_answer(
        self,
        question: str,
        category: str,
        user_answer: str,
        expected_answer_points: list[str],
    ) -> QuestionEvaluationResponse:
        """
        Score a single interview answer and return structured AI feedback.

        Parameters
        ----------
        question                : The interview question text.
        category                : Question category (technical|behavioral|situational).
        user_answer             : The candidate's answer text.
        expected_answer_points  : AI-suggested answer points from question generation.

        Returns
        -------
        QuestionEvaluationResponse with score 1-10, feedback, ideal_answer,
        and improvement_suggestions.

        Raises
        ------
        ValidationError         : AI response doesn't match schema.
        asyncio.TimeoutError    : Groq took too long.
        """
        points_text = "\n".join(f"- {p}" for p in expected_answer_points)
        template = load_prompt_template("question_evaluation.txt")
        # Use _safe_format so { } in user answers/questions don't crash str.format()
        prompt = self._safe_format(
            template,
            question=question,
            category=category,
            user_answer=user_answer,
            expected_answer_points=points_text,
        )
        return await self._generate_structured_response(prompt, QuestionEvaluationResponse)

    # ── Public: job match analysis ────────────────────────────────────────────

    async def analyze_job_match(
        self,
        resume_text: str,
        job_description: str,
    ) -> tuple[JobMatchAnalysisResponse, bool]:
        """
        Analyse how well a resume matches a job description.

        Parameters
        ----------
        resume_text     : Plain text extracted from the candidate's resume.
        job_description : Raw job description text pasted by the user.

        Returns
        -------
        (JobMatchAnalysisResponse, is_fallback)
            is_fallback is True when the result was produced by the fallback
            handler (i.e. Groq returned malformed JSON).

        Raises
        ------
        RuntimeError          : GROQ_API_KEY not configured.
        asyncio.TimeoutError  : Groq took longer than GROQ_TIMEOUT_SECONDS.
        """
        template = load_prompt_template("job_match.txt")
        prompt = self._safe_format(
            template,
            resume_text=resume_text,
            job_description=job_description,
        )

        try:
            result = await self._generate_structured_response(prompt, JobMatchAnalysisResponse)
            return result, False

        except (ValidationError, json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "JobMatchAnalysisResponse validation failed — using fallback. Error: %s", exc
            )
            fallback = JobMatchAnalysisResponse(
                match_score=0,
                ats_score=0,
                strengths=["Could not extract strengths — please try again."],
                missing_keywords=["Analysis unavailable — please retry."],
                missing_skills=["Analysis unavailable — please retry."],
                recommendations=["The AI analysis could not be parsed. Please retry."],
                role_fit="Analysis unavailable due to an AI formatting error.",
                interview_readiness="Analysis unavailable — please retry.",
                summary=f"The AI analysis could not be parsed. Reason: {exc}",
            )
            return fallback, True

        except Exception as exc:
            logger.error("Groq error during job match analysis: %s", exc)
            raise


# ── Module-level singleton ────────────────────────────────────────────────────

ai_service = AIService()

