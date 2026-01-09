from fastapi import APIRouter, Depends, HTTPException
from ..db import get_pool
from ..models import SubscribeIn, SubscriptionOut
from ..security import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

@router.get("", response_model=list[SubscriptionOut])
async def my_subs(user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """SELECT id, subscriber_id, trader_id, status, started_at, ends_at
                 FROM subscriptions WHERE subscriber_id=$1
                 ORDER BY started_at DESC""",
            user["id"]
        )
    return [dict(r) for r in rows]

@router.post("", response_model=SubscriptionOut)
async def subscribe(payload: SubscribeIn, user=Depends(get_current_user)):
    if payload.trader_id == user["id"]:
        raise HTTPException(400, "You can't subscribe to yourself.")
    pool = await get_pool()
    async with pool.acquire() as con:
        # Ensure trader exists
        exists = await con.fetchrow("SELECT 1 FROM trader_profiles WHERE user_id=$1", payload.trader_id)
        if not exists:
            raise HTTPException(404, "Trader not found")

        # MVP: DB-backed subscription (Stripe hook to be added)
        row = await con.fetchrow(
            """INSERT INTO subscriptions(subscriber_id, trader_id, status)
                 VALUES($1,$2,'active')
                 ON CONFLICT (subscriber_id, trader_id)
                 DO UPDATE SET status='active', ends_at=NULL
                 RETURNING id, subscriber_id, trader_id, status, started_at, ends_at""",
            user["id"], payload.trader_id
        )
    return dict(row)

@router.post("/{trader_id}/cancel")
async def cancel(trader_id: str, user=Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as con:
        res = await con.execute(
            """UPDATE subscriptions
                 SET status='canceled', ends_at=now()
                 WHERE subscriber_id=$1 AND trader_id=$2""",
            user["id"], trader_id
        )
    return {"ok": True, "result": res}
