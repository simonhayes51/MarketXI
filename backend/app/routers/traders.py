from fastapi import APIRouter, Depends, HTTPException
from ..db import get_pool
from ..models import TraderProfileUpsert, TraderProfileOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/traders", tags=["traders"])

@router.get("", response_model=list[TraderProfileOut])
async def list_traders():
    pool = await get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """SELECT tp.user_id, tp.display_name, tp.bio, tp.banner_url, tp.avatar_url,
                      tp.subscription_price_cents, tp.is_verified, tp.created_at
                 FROM trader_profiles tp
                 ORDER BY tp.is_verified DESC, tp.created_at DESC
            """
        )
    return [dict(r) for r in rows]

@router.get("/{trader_id}", response_model=TraderProfileOut)
async def get_trader(trader_id: str):
    pool = await get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            """SELECT user_id, display_name, bio, banner_url, avatar_url,
                      subscription_price_cents, is_verified, created_at
                 FROM trader_profiles WHERE user_id=$1""", trader_id
        )
    if not row:
        raise HTTPException(404, "Trader not found")
    return dict(row)

@router.post("/me", response_model=TraderProfileOut)
async def upsert_my_profile(payload: TraderProfileUpsert, user=Depends(require_role("trader","admin"))):
    pool = await get_pool()
    async with pool.acquire() as con:
        # ensure user exists & role trader
        await con.execute(
            """INSERT INTO trader_profiles(user_id, display_name, bio, banner_url, avatar_url, subscription_price_cents)
                 VALUES($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (user_id) DO UPDATE SET
                   display_name=EXCLUDED.display_name,
                   bio=EXCLUDED.bio,
                   banner_url=EXCLUDED.banner_url,
                   avatar_url=EXCLUDED.avatar_url,
                   subscription_price_cents=EXCLUDED.subscription_price_cents
            """,
            user["id"], payload.display_name, payload.bio, payload.banner_url, payload.avatar_url, payload.subscription_price_cents
        )
        row = await con.fetchrow(
            """SELECT user_id, display_name, bio, banner_url, avatar_url,
                      subscription_price_cents, is_verified, created_at
                 FROM trader_profiles WHERE user_id=$1""", user["id"]
        )
    return dict(row)

@router.post("/me/become-trader")
async def become_trader(user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as con:
        await con.execute("UPDATE users SET role='trader' WHERE id=$1 AND role='user'", user["id"])
        row = await con.fetchrow("SELECT role FROM users WHERE id=$1", user["id"])
    return {"role": row["role"]}
