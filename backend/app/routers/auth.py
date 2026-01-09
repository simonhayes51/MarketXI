from fastapi import APIRouter, HTTPException, Depends
from ..db import get_pool
from ..models import RegisterIn, LoginIn, TokenOut, UserOut
from ..security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserOut)
async def register(payload: RegisterIn):
    pool = await get_pool()
    async with pool.acquire() as con:
        existing = await con.fetchrow("SELECT 1 FROM users WHERE email=$1 OR username=$2", payload.email.lower(), payload.username)
        if existing:
            raise HTTPException(409, "Email or username already in use")
        row = await con.fetchrow(
            """INSERT INTO users(email, password_hash, username, role)
               VALUES($1,$2,$3,'user')
               RETURNING id, email, username, role, discord_id""",
            payload.email.lower(),
            hash_password(payload.password),
            payload.username
        )
    return dict(row)

@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn):
    pool = await get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow("SELECT id, password_hash FROM users WHERE email=$1", payload.email.lower())
    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(access_token=create_access_token(str(row["id"])))

@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return user
