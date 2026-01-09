from fastapi import APIRouter, Depends, HTTPException
from ..db import get_pool
from ..models import PostCreateIn, PostOut
from ..security import get_current_user, require_role

router = APIRouter(prefix="/posts", tags=["posts"])

async def _is_subscribed(pool, subscriber_id: str, trader_id: str) -> bool:
    async with pool.acquire() as con:
        row = await con.fetchrow(
            """SELECT 1 FROM subscriptions
                 WHERE subscriber_id=$1 AND trader_id=$2 AND status='active'""",
            subscriber_id, trader_id
        )
    return bool(row)

@router.post("", response_model=PostOut)
async def create_post(payload: PostCreateIn, user=Depends(require_role("trader","admin"))):
    pool = await get_pool()
    async with pool.acquire() as con:
        post = await con.fetchrow(
            """INSERT INTO posts(trader_id, type, title, content, is_premium, expires_at)
                 VALUES($1,$2,$3,$4,$5,$6)
                 RETURNING id, trader_id, type, title, content, is_premium, created_at, expires_at""",
            user["id"], payload.type, payload.title, payload.content, payload.is_premium, payload.expires_at
        )
        cards_out = []
        for c in payload.cards:
            card = await con.fetchrow(
                """INSERT INTO post_cards(post_id, player_id, platform, buy_price_min, buy_price_max, sell_price_min, sell_price_max)
                     VALUES($1,$2,$3,$4,$5,$6,$7)
                     RETURNING id, player_id, platform, buy_price_min, buy_price_max, sell_price_min, sell_price_max""",
                post["id"], c.player_id, c.platform, c.buy_price_min, c.buy_price_max, c.sell_price_min, c.sell_price_max
            )
            cards_out.append(dict(card))

        trader_name = await con.fetchval("SELECT display_name FROM trader_profiles WHERE user_id=$1", user["id"])
    d = dict(post)
    d["cards"] = cards_out
    d["trader_display_name"] = trader_name
    d["locked"] = False
    return d

@router.get("/feed", response_model=list[PostOut])
async def feed(user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """SELECT p.id, p.trader_id, p.type, p.title, p.content, p.is_premium, p.created_at, p.expires_at,
                      tp.display_name AS trader_display_name
                 FROM posts p
                 LEFT JOIN trader_profiles tp ON tp.user_id=p.trader_id
                 ORDER BY p.created_at DESC
                 LIMIT 100"""
        )

    out = []
    for r in rows:
        locked = False
        content = r["content"]
        if r["is_premium"] and str(r["trader_id"]) != user["id"]:
            if not await _is_subscribed(pool, user["id"], str(r["trader_id"])):
                locked = True
                content = "Subscribe to unlock this post."

        async with pool.acquire() as con:
            cards = await con.fetch(
                """SELECT id, player_id, platform, buy_price_min, buy_price_max, sell_price_min, sell_price_max
                     FROM post_cards WHERE post_id=$1""",
                r["id"]
            )

        d = dict(r)
        d["content"] = content
        d["cards"] = [dict(c) for c in cards]
        d["locked"] = locked
        out.append(d)
    return out
