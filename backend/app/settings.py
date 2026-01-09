from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_exp_minutes: int = 60 * 24 * 7

    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None

    discord_client_id: str | None = None
    discord_client_secret: str | None = None
    discord_redirect_uri: str | None = None
    discord_bot_token: str | None = None
    discord_guild_id: str | None = None
    discord_premium_role_id: str | None = None

    class Config:
        env_file = ".env"

settings = Settings()
