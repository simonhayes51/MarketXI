from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_schema, close_pool
from .routers import auth, traders, posts, subscriptions, discord

app = FastAPI(title="MarketXI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_schema()

@app.on_event("shutdown")
async def shutdown():
    await close_pool()

app.include_router(auth.router)
app.include_router(traders.router)
app.include_router(posts.router)
app.include_router(subscriptions.router)
app.include_router(discord.router)
