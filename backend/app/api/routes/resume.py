"""
resume.py  (route)
------------------
FastAPI router for resume-related endpoints.

POST /api/v1/resume/upload
  - Protected: requires a valid Supabase Bearer token.
  - Accepts multipart/form-data with a single file field ("file").
  - Query param ?analyse=true  → also runs Gemini AI analysis.
  - Validates extension, MIME type, and file size.
  - Extracts plain text from PDF or DOCX.
  - Returns extracted text and (optionally) structured AI analysis.
  - Does NOT persist anything to the database yet.

Dependency injection
--------------------
get_current_user           → verifies JWT and returns SupabaseUser
validate_and_parse_resume  → all validation + parsing + optional AI in service layer
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.api.dependencies import get_current_user
from app.schemas.auth import SupabaseUser
from app.schemas.resume import ResumeUploadResponse
from app.services.resume_service import validate_and_parse_resume

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    summary="Upload and parse a resume (optionally with AI analysis)",
    description=(
        "Upload a PDF or DOCX resume (max 5 MB). "
        "The endpoint validates the file and extracts plain text. "
        "Pass **?analyse=true** to also receive a structured Gemini AI analysis. "
        "Nothing is stored in the database."
    ),
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file — .pdf or .docx, max 5 MB"),
    analyse: bool = Query(
        default=False,
        description=(
            "Set to true to run Gemini AI analysis on the extracted text. "
            "Adds overall_score, strengths, weaknesses, missing_skills, "
            "recommended_roles, and improvement_suggestions to the response."
        ),
    ),
    current_user: SupabaseUser = Depends(get_current_user),
) -> ResumeUploadResponse:
    """
    Protected resume upload endpoint.

    Steps:
    1. get_current_user verifies the Supabase Bearer token.
    2. validate_and_parse_resume validates, extracts text, and (when
       ?analyse=true) calls the AI service.
    3. The result is returned as JSON.
    """
    return await validate_and_parse_resume(file, analyse=analyse)
