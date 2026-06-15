from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.health import router as health_router
from app.api.routes.interview import router as interview_router
from app.api.routes.job_match import router as job_match_router
from app.api.routes.profile import router as profile_router
from app.api.routes.resume import router as resume_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(resume_router)
api_router.include_router(dashboard_router)
api_router.include_router(interview_router)
api_router.include_router(job_match_router)


