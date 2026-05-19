"""
analysis.py  (schemas)
-----------------------
Public re-export of AI analysis schemas used by the resume upload endpoint.

Import from here in routes and services so consumers don't need to know
whether the schema lives in schemas/ai.py or somewhere else.
"""

from __future__ import annotations

# Re-export so routes/services can do:
#   from app.schemas.analysis import ResumeAnalysisResult
from app.schemas.ai import ResumeAnalysisResponse as ResumeAnalysisResult

__all__ = ["ResumeAnalysisResult"]
