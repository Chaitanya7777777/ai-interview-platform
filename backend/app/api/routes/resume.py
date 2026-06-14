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

GET  /api/v1/resume/{resume_id}/download
    Generate a signed Supabase Storage URL and return HTTP 307 redirect.
    Frontend uses window.open(endpoint_url) — never sees the signed URL directly.

DELETE /api/v1/resume/{resume_id}
    Delete resume from Storage (first) then DB. Abort if Storage delete fails.

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

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.db.models.resume import Resume
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
    2. Validate the file, extract text.
    3. Upload to Supabase Storage (after parse succeeds — no orphan files).
    4. Persist to DB with storage path.
    5. Optionally run AI analysis and persist the result.
    6. Commit the transaction.
    7. Return the full response.
    """
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


@router.get(
    "/{resume_id}/download",
    summary="Download original resume file",
    description=(
        "Verify ownership, generate a 10-minute signed Supabase Storage URL, "
        "and return HTTP 307 Temporary Redirect. "
        "Frontend calls window.open(this_endpoint_url) — the signed URL is "
        "never exposed as a JSON payload."
    ),
)
async def download_resume(
    resume_id: str,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """
    1. Parse and validate resume UUID.
    2. Resolve user's profile.
    3. Fetch resume — verify it belongs to this profile.
    4. If file_url is empty → 404 (legacy row, no file stored).
    5. Generate signed URL via storage_service.
    6. Return 307 Temporary Redirect to the signed URL.
    """
    from app.services.storage_service import get_signed_url  # noqa: PLC0415

    try:
        resume_uuid = UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid resume ID.")

    profile = await get_or_create_profile(session, current_user)

    # Fetch resume with ownership check
    stmt = select(Resume).where(
        Resume.id == resume_uuid,
        Resume.profile_id == profile.id,
    )
    result = await session.execute(stmt)
    resume = result.scalar_one_or_none()

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found.")

    if not resume.file_url:
        raise HTTPException(
            status_code=404,
            detail="No file stored for this resume. It was uploaded before file storage was enabled.",
        )

    try:
        signed_url = await get_signed_url(resume.file_url, expires_in=600)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    # 307 Temporary Redirect — browser opens signed URL directly
    return RedirectResponse(url=signed_url, status_code=307)


@router.delete(
    "/{resume_id}",
    summary="Delete a resume",
    description=(
        "Delete resume file from Supabase Storage first, then delete the DB record. "
        "If storage deletion fails, the DB record is preserved and the request aborts."
    ),
)
async def delete_resume_endpoint(
    resume_id: str,
    current_user: SupabaseUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """
    1. Parse and validate the resume UUID.
    2. Resolve the user's profile.
    3. Delete from Storage first (abort if fails).
    4. Delete the DB row.
    5. Commit.
    """
    try:
        resume_uuid = UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid resume ID.")

    profile = await get_or_create_profile(session, current_user)

    try:
        await delete_resume(session, resume_id=resume_uuid, profile_id=profile.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Storage delete failed — DB row preserved, inform the client
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    await session.commit()
    return Response(status_code=204)
