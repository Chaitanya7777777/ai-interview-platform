"""
docx_parser.py
--------------
Utility for extracting plain text from a DOCX file on disk.

Uses python-docx (sync) wrapped in asyncio.to_thread so the CPU-bound
extraction does not block the async event loop.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import HTTPException, status


def _extract_docx_text_sync(file_path: Path) -> str:
    """
    Synchronous DOCX text extraction using python-docx.

    Reads every paragraph in the document body and joins them.
    Raises HTTPException(422) if the file cannot be parsed.
    """
    try:
        import docx  # local import so the rest of the app boots even if missing
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="python-docx is not installed. Run: pip install python-docx",
        ) from exc

    try:
        document = docx.Document(str(file_path))
        paragraphs: list[str] = []

        for para in document.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)

        extracted = "\n\n".join(paragraphs).strip()

        if not extracted:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="DOCX file appears to be empty. No extractable text was found.",
            )

        return extracted

    except HTTPException:
        raise  # re-raise our own validation errors

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse DOCX: {exc}",
        ) from exc


async def extract_text_from_docx(file_path: Path) -> str:
    """
    Async wrapper around the synchronous DOCX extraction.

    Runs the blocking I/O in a thread pool to keep the event loop free.
    """
    return await asyncio.to_thread(_extract_docx_text_sync, file_path)
