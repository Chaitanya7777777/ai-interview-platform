from __future__ import annotations

import asyncio
import json
import re
from typing import TypeVar

from google import genai
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.ai import InterviewFeedbackResponse, InterviewQuestionSet, ResumeAnalysisResponse
from app.utils.prompt_loader import load_prompt_template

T = TypeVar("T", bound=BaseModel)


class AIService:
    def __init__(self) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None

    def _ensure_client(self) -> genai.Client:
        if self._client is None:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        return self._client

    @staticmethod
    def _extract_json(text: str) -> str:
        stripped_text = text.strip()
        if stripped_text.startswith("```"):
            stripped_text = re.sub(r"^```(?:json)?\s*", "", stripped_text)
            stripped_text = re.sub(r"\s*```$", "", stripped_text)

        return stripped_text

    @staticmethod
    def _validate_response(raw_text: str, schema: type[T]) -> T:
        return schema.model_validate_json(AIService._extract_json(raw_text))

    def _generate_text_sync(self, prompt: str) -> str:
        client = self._ensure_client()
        response = client.models.generate_content(model=settings.gemini_model, contents=prompt)

        if not response.text:
            raise RuntimeError("Gemini returned an empty response.")

        return response.text

    async def _generate_structured_response(self, prompt: str, schema: type[T]) -> T:
        raw_text = await asyncio.to_thread(self._generate_text_sync, prompt)
        return self._validate_response(raw_text, schema)

    async def analyze_resume(self, resume_text: str) -> ResumeAnalysisResponse:
        prompt = load_prompt_template("resume_analysis.txt").format(resume_text=resume_text)
        return await self._generate_structured_response(prompt, ResumeAnalysisResponse)

    async def generate_interview_questions(self, candidate_context: str, role_focus: str, difficulty: str) -> InterviewQuestionSet:
        prompt = load_prompt_template("interview_questions.txt").format(
            candidate_context=candidate_context,
            role_focus=role_focus,
            difficulty=difficulty,
        )
        return await self._generate_structured_response(prompt, InterviewQuestionSet)

    async def generate_interview_feedback(self, transcript: list[dict[str, str]]) -> InterviewFeedbackResponse:
        transcript_json = json.dumps(transcript, ensure_ascii=False, indent=2)
        prompt = load_prompt_template("interview_feedback.txt").format(transcript=transcript_json)
        return await self._generate_structured_response(prompt, InterviewFeedbackResponse)


ai_service = AIService()
