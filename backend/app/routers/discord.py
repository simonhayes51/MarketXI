from fastapi import APIRouter, Depends, HTTPException
from ..security import get_current_user
from ..settings import settings

router = APIRouter(prefix="/discord", tags=["discord"])

@router.get("/oauth-url")
async def oauth_url(user=Depends(get_current_user)):
    if not settings.discord_client_id or not settings.discord_redirect_uri:
        raise HTTPException(400, "Discord not configured")
    # Basic OAuth URL (scope can be expanded later for guild join/role sync)
    url = (
        "https://discord.com/oauth2/authorize"
        f"?client_id={settings.discord_client_id}"
        f"&redirect_uri={settings.discord_redirect_uri}"
        "&response_type=code"
        "&scope=identify%20email"
    )
    return {"url": url}

@router.post("/callback")
async def callback(code: str, user=Depends(get_current_user)):
    # MVP stub:
    # - exchange code for token
    # - fetch /users/@me
    # - store discord_id against users table
    return {"ok": True, "note": "Stub: implement token exchange + role sync here."}
