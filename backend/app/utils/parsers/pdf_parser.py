"""
pdf_parser.py
-------------
Utility for extracting plain text from a PDF file on disk.

Uses pypdf (sync) wrapped in asyncio.to_thread so the CPU-bound
extraction does not block the async event loop.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import HTTPException, status


def _extract_pdf_text_sync(file_path: Path) -> str:
    """
    Synchronous PDF text extraction using pypdf.

    Iterates every page and concatenates the text.
    Raises HTTPException(422) if the file cannot be read as a PDF.
    """
    try:
        import pypdf  # local import so the rest of the app boots even if missing
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pypdf is not installed. Run: pip install pypdf",
        ) from exc

    try:
        reader = pypdf.PdfReader(str(file_path))
        pages_text: list[str] = []

        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text.strip())

        extracted = "\n\n".join(pages_text).strip()

        if not extracted:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="PDF appears to be empty or contains only images/scanned content. No extractable text was found.",
            )

        return extracted

    except HTTPException:
        raise  # re-raise our own validation errors

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse PDF: {exc}",
        ) from exc


async def extract_text_from_pdf(file_path: Path) -> str:
    """
    Async wrapper around the synchronous PDF extraction.

    Runs the blocking I/O in a thread pool to keep the event loop free.
    """
    return await asyncio.to_thread(_extract_pdf_text_sync, file_path)
