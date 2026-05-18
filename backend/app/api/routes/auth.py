from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.schemas.auth import SupabaseUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=SupabaseUser)
async def read_current_user(current_user: SupabaseUser = Depends(get_current_user)) -> SupabaseUser:
    return current_user
