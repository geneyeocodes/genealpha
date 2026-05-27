from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = Field(default="")
    ibkr_host: str = Field(default="")
    ibkr_port: int = Field(default=0)
    anthropic_api_key: str = Field(default="")
    openai_api_key: str = Field(default="")
    polygon_api_key: str = Field(default="")

    model_config = {
        "env_file": Path(__file__).resolve().parent.parent / ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
