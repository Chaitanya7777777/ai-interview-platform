"""
storage_service.py
------------------
Isolated Supabase Storage layer using the REST API directly via httpx.

Why REST instead of supabase-py?
  supabase-py 2.x requires pydantic>=2.10, which conflicts with our pinned
  pydantic==2.7.4. Using httpx against the documented Storage REST API gives
  us full control and zero dependency conflicts.

Bucket design
-------------
  resumes/           ← private, authenticated access only
  job-descriptions/  ← private, job description .txt files
  voice/             ← reserved for future voice interview recordings

Only "resumes" and "job-descriptions" buckets are implemented today.

Storage path formats
--------------------
  resumes/{profile_id}/{YYYYMMDD}_{uuid8}.{ext}
  job-descriptions/{profile_id}/{YYYYMMDD}_{uuid8}.txt

Security
--------
  SUPABASE_SERVICE_ROLE_KEY is ONLY used here, on the backend.
  It is NEVER returned to the frontend.
  Signed URLs are generated server-side and returned as 307 redirects.

API reference
-------------
  https://supabase.com/docs/reference/javascript/storage-from-upload
  POST   /storage/v1/object/{bucket}/{path}          — upload
  DELETE /storage/v1/object/{bucket}                 — delete (body: prefixes)
  POST   /storage/v1/object/sign/{bucket}/{path}     — create signed URL
  GET    /storage/v1/object/authenticated/{bucket}/{path} — download (auth'd)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Internal helpers ──────────────────────────────────────────────────────────

def _base_url() -> str:
    """Supabase project URL, stripped of trailing slash."""
    url = (settings.supabase_url or "").rstrip("/")
    if not url:
        raise RuntimeError(
            "SUPABASE_URL is not configured. "
            "Add it to your .env or Render environment variables."
        )
    return url


def _auth_headers() -> dict[str, str]:
    """Service-role auth headers — NEVER sent to the frontend."""
    key = settings.supabase_service_role_key
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured. "
            "Add it to your .env or Render environment variables."
        )
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


def _storage_available() -> bool:
    """Return True only when both SUPABASE_URL and SERVICE_ROLE_KEY are set."""
    return bool(settings.supabase_url and settings.supabase_service_role_key)


# ── Path generation ───────────────────────────────────────────────────────────

def build_storage_path(profile_id: UUID, extension: str) -> str:
    """
    Build a deterministic, collision-free storage object path.

    Format: resumes/{profile_id}/{YYYYMMDD}_{uuid8}{.ext}
    Example: resumes/abc123/20260609_6fa7a8b9.pdf

    Parameters
    ----------
    profile_id : UUID of the authenticated user's Profile row
    extension  : lowercased file extension including dot, e.g. ".pdf"

    Returns
    -------
    Full object path string (NOT a URL).
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    uid_short = uuid4().hex[:8]
    bucket = settings.supabase_storage_bucket
    return f"{bucket}/{profile_id}/{date_str}_{uid_short}{extension}"


# ── Core operations ───────────────────────────────────────────────────────────

async def upload_file(
    object_path: str,
    data: bytes,
    content_type: str,
) -> str:
    """
    Upload raw bytes to Supabase Storage.

    Parameters
    ----------
    object_path  : full object path, e.g. "resumes/abc/20260609_6fa.pdf"
    data         : raw file bytes
    content_type : MIME type string, e.g. "application/pdf"

    Returns
    -------
    The object_path (stored in DB as file_url).

    Raises
    ------
    RuntimeError : storage not configured or upload failed
    """
    if not _storage_available():
        logger.warning(
            "Supabase Storage not configured — skipping upload for %s", object_path
        )
        return ""

    # Strip bucket prefix from object_path for the URL construction
    # object_path = "resumes/{profile_id}/..." → split off bucket
    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/{bucket}/{path_in_bucket}"
    headers = {
        **_auth_headers(),
        "Content-Type": content_type,
        "x-upsert": "true",  # overwrite if somehow same path exists
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, content=data, headers=headers)

    if response.status_code not in (200, 201):
        logger.error(
            "Storage upload failed: status=%s body=%s path=%s",
            response.status_code,
            response.text[:300],
            object_path,
        )
        raise RuntimeError(
            f"Failed to upload resume to storage (HTTP {response.status_code}). "
            "Please try again."
        )

    logger.info("Uploaded file to storage: %s (%d bytes)", object_path, len(data))
    return object_path


async def delete_file(object_path: str) -> None:
    """
    Delete an object from Supabase Storage.

    Called BEFORE the DB row is deleted to prevent orphaned files.
    If the file doesn't exist, this is a no-op (idempotent).

    Parameters
    ----------
    object_path : full object path stored in file_url column

    Raises
    ------
    RuntimeError : storage not configured, or delete failed with a server error
    """
    if not object_path:
        return  # no file to delete (legacy rows with file_url="")

    if not _storage_available():
        logger.warning(
            "Supabase Storage not configured — skipping delete for %s", object_path
        )
        return

    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/{bucket}"
    headers = {
        **_auth_headers(),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.request(
            "DELETE",
            url,
            headers=headers,
            json={"prefixes": [path_in_bucket]},
        )

    if response.status_code == 404:
        logger.info("Storage object not found (already deleted?): %s", object_path)
        return

    if response.status_code not in (200, 204):
        logger.error(
            "Storage delete failed: status=%s body=%s path=%s",
            response.status_code,
            response.text[:300],
            object_path,
        )
        raise RuntimeError(
            f"Failed to delete resume file from storage (HTTP {response.status_code}). "
            "Delete aborted to prevent orphaned files."
        )

    logger.info("Deleted storage object: %s", object_path)


async def get_signed_url(object_path: str, expires_in: int = 600) -> str:
    """
    Generate a time-limited signed URL for private object access.

    Parameters
    ----------
    object_path : full object path, e.g. "resumes/abc/20260609_6fa.pdf"
    expires_in  : expiry in seconds (default 600 = 10 minutes)

    Returns
    -------
    Signed URL string that expires after `expires_in` seconds.

    Raises
    ------
    RuntimeError : storage not configured or signing failed
    """
    if not _storage_available():
        raise RuntimeError("Supabase Storage is not configured on this server.")

    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/sign/{bucket}/{path_in_bucket}"
    headers = {
        **_auth_headers(),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            url,
            headers=headers,
            json={"expiresIn": expires_in},
        )

    if response.status_code not in (200, 201):
        logger.error(
            "Signed URL generation failed: status=%s body=%s path=%s",
            response.status_code,
            response.text[:300],
            object_path,
        )
        raise RuntimeError("Failed to generate download link. Please try again.")

    data = response.json()
    # Supabase returns either {"signedURL": "..."} or {"signedUrl": "..."}
    signed = data.get("signedURL") or data.get("signedUrl") or data.get("signed_url")
    if not signed:
        raise RuntimeError("Storage returned an unexpected response format.")

    # Prefix with project URL if the path is relative
    if signed.startswith("/"):
        signed = f"{_base_url()}{signed}"

    logger.debug("Generated signed URL for %s (expires_in=%ds)", object_path, expires_in)
    return signed


async def file_exists(object_path: str) -> bool:
    """
    Check whether a storage object exists using a HEAD request.

    Parameters
    ----------
    object_path : full object path

    Returns
    -------
    True if the object exists and is accessible, False otherwise.
    """
    if not object_path or not _storage_available():
        return False

    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/authenticated/{bucket}/{path_in_bucket}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.head(url, headers=_auth_headers())
        return response.status_code == 200
    except httpx.RequestError:
        return False


# ── Job-description text storage ──────────────────────────────────────────────

_JD_BUCKET = "job-descriptions"


def build_jd_storage_path(profile_id: UUID) -> str:
    """
    Build a collision-free storage path for a job description text file.

    Format: job-descriptions/{profile_id}/{YYYYMMDD}_{uuid8}.txt
    Example: job-descriptions/abc123/20260615_7fa3c8b1.txt

    Parameters
    ----------
    profile_id : UUID of the authenticated user's Profile row

    Returns
    -------
    Full object path string (NOT a URL).
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    uid_short = uuid4().hex[:8]
    return f"{_JD_BUCKET}/{profile_id}/{date_str}_{uid_short}.txt"


async def upload_text(object_path: str, text: str) -> str:
    """
    Upload a UTF-8 text string to Supabase Storage.

    Used for job description files stored in the job-descriptions bucket.

    Parameters
    ----------
    object_path : full object path, e.g. "job-descriptions/abc/20260615_7fa.txt"
    text        : raw text content to upload

    Returns
    -------
    The object_path (stored in DB as job_description_path).

    Raises
    ------
    RuntimeError : storage not configured or upload failed
    """
    if not _storage_available():
        raise RuntimeError(
            "Supabase Storage is not configured. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    data = text.encode("utf-8")

    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/{bucket}/{path_in_bucket}"
    headers = {
        **_auth_headers(),
        "Content-Type": "text/plain; charset=utf-8",
        "x-upsert": "true",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, content=data, headers=headers)

    if response.status_code not in (200, 201):
        logger.error(
            "Text upload failed: status=%s body=%s path=%s",
            response.status_code,
            response.text[:300],
            object_path,
        )
        raise RuntimeError(
            f"Failed to upload job description to storage (HTTP {response.status_code}). "
            "Please try again."
        )

    logger.info("Uploaded JD text to storage: %s (%d bytes)", object_path, len(data))
    return object_path


async def download_text(object_path: str) -> str:
    """
    Download a text object from Supabase Storage and return its content.

    Uses the authenticated endpoint (service role key) — never returns
    a URL to the caller.

    Parameters
    ----------
    object_path : full object path, e.g. "job-descriptions/abc/20260615_7fa.txt"

    Returns
    -------
    UTF-8 decoded text content.

    Raises
    ------
    RuntimeError : storage not configured, object not found, or download failed
    """
    if not _storage_available():
        raise RuntimeError("Supabase Storage is not configured.")

    parts = object_path.split("/", 1)
    bucket = parts[0]
    path_in_bucket = parts[1] if len(parts) > 1 else object_path

    url = f"{_base_url()}/storage/v1/object/authenticated/{bucket}/{path_in_bucket}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, headers=_auth_headers())

    if response.status_code == 404:
        raise RuntimeError(f"Job description file not found in storage: {object_path}")

    if response.status_code not in (200, 206):
        logger.error(
            "Text download failed: status=%s body=%s path=%s",
            response.status_code,
            response.text[:300],
            object_path,
        )
        raise RuntimeError(
            f"Failed to retrieve job description from storage (HTTP {response.status_code})."
        )

    logger.debug("Downloaded JD text from storage: %s", object_path)
    return response.content.decode("utf-8")

