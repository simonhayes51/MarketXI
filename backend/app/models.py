from pydantic import BaseModel, EmailStr, Field
from typing import Literal
from datetime import datetime

Role = Literal["user", "trader", "admin"]
PostType = Literal["trade", "sbc", "prediction"]
Platform = Literal["ps", "xbox", "pc"]

class RegisterIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    role: Role
    discord_id: str | None = None

class TraderProfileUpsert(BaseModel):
    display_name: str
    bio: str = ""
    banner_url: str | None = None
    avatar_url: str | None = None
    subscription_price_cents: int = 999

class TraderProfileOut(BaseModel):
    user_id: str
    display_name: str
    bio: str
    banner_url: str | None = None
    avatar_url: str | None = None
    subscription_price_cents: int
    is_verified: bool
    created_at: datetime

class PostCardIn(BaseModel):
    player_id: str
    platform: Platform = "ps"
    buy_price_min: int | None = None
    buy_price_max: int | None = None
    sell_price_min: int | None = None
    sell_price_max: int | None = None

class PostCreateIn(BaseModel):
    type: PostType = "trade"
    title: str
    content: str
    is_premium: bool = True
    expires_at: datetime | None = None
    cards: list[PostCardIn] = []

class PostCardOut(PostCardIn):
    id: str

class PostOut(BaseModel):
    id: str
    trader_id: str
    trader_display_name: str | None = None
    type: PostType
    title: str
    content: str
    is_premium: bool
    created_at: datetime
    expires_at: datetime | None = None
    cards: list[PostCardOut] = []
    locked: bool = False

class SubscribeIn(BaseModel):
    trader_id: str

class SubscriptionOut(BaseModel):
    id: str
    subscriber_id: str
    trader_id: str
    status: str
    started_at: datetime
    ends_at: datetime | None = None
