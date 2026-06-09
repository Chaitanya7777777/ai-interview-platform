"""
resume.py  (route)
------------------
FastAPI router for resume-related endpoints.

Endpoints
---------
POST /api/v1/resume/upload
    Upload a PDF or DOCX resume, extract text, persist to DB,
    and optionally run AI analysis (?analyse=true).

GET  /api/v1/resume/history
    Return the authenticated user's paginated resume upload history.

Dependency injection
--------------------
get_current_user    → verifies JWT, returns SupabaseUser
get_db_session      → provides an async SQLAlchemy session
get_or_create_profile (via service) → resolves profile_id from auth user

Transaction contract
--------------------
The route calls session.commit() after the service completes.
The service only calls session.flush() so every DB write in a single
request is committed atomically.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.schemas.auth import SupabaseUser
from app.schemas.resume import ResumeHistoryPage, ResumeUploadResponse
from app.services.profile_service import get_or_create_profile
from app.services.resume_db_service import delete_resume, get_resume_history
from app.services.resume_service import validate_and_parse_resume

router = APIRouter(prefix="/resume", tags=["resume"])

# Max records per page the caller may request
MAX_PAGE_SIZE = 50


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and parse a resume",
    description=(
        "Upload a PDF or DOCX resume (max 5 MB). "
        "The file is validated, text is extracted, and the record is "
        "persisted to the database. "
        "Pass **?analyse=true** to also receive a structured AI analysis."
    ),
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file — .pdf or .docx, max 5 MB"),
    analyse: bool = Query(
        default=False,
        description=(
            "Set to true to run AI analysis on the extracted text. "
            "Adds overall_score, strengths, weaknesses, missing_skills, "
            "recommended_roles, and improvement_suggestions to the response."
        ),
    ),
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ResumeUploadResponse:
    """
    Protected resume upload endpoint.

    1. Resolve (or create) the user's Profile row from their JWT.
    2. Validate the file, extract text, persist to DB.
    3. Optionally run AI analysis and persist the result.
    4. Commit the transaction.
    5. Return the full response.
    """
    # Resolve the profile so we have a profile_id for the resume FK
    profile = await get_or_create_profile(session, current_user)

    result = await validate_and_parse_resume(
        file,
        profile_id=profile.id,
        session=session,
        analyse=analyse,
    )

    await session.commit()
    return result


@router.get(
    "/history",
    response_model=ResumeHistoryPage,
    summary="Get resume upload history",
    description=(
        "Return the authenticated user's paginated resume history "
        "(newest first). Each item contains metadata and AI analysis "
        "if it was run. The full extracted text is NOT included to keep "
        "responses lightweight."
    ),
)
async def get_resume_history_endpoint(
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(
        default=10,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Records per page (max {MAX_PAGE_SIZE})",
    ),
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ResumeHistoryPage:
    """
    Protected resume history endpoint.

    1. Resolve the user's Profile row.
    2. Query resumes for that profile, ordered newest-first.
    3. Return paginated result with total_count and page metadata.
    """
    profile = await get_or_create_profile(session, current_user)

    history = await get_resume_history(
        session,
        profile_id=profile.id,
        page=page,
        page_size=page_size,
    )

    # No writes → no commit needed for read-only endpoints
    return history


@router.delete(
    "/{resume_id}",
    summary="Delete a resume",
    description="Permanently delete a resume record owned by the authenticated user.",
)
async def delete_resume_endpoint(
    resume_id: str,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """
    1. Parse and validate the resume UUID.
    2. Resolve the user's profile.
    3. Delete the resume (ownership enforced in the service).
    4. Commit.
    """
    from uuid import UUID
    try:
        resume_uuid = UUID(resume_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Invalid resume ID.")

    profile = await get_or_create_profile(session, current_user)

    try:
        await delete_resume(session, resume_id=resume_uuid, profile_id=profile.id)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    await session.commit()
    return Response(status_code=204)
