"""
Environment-driven settings for provider selection and RunPod endpoints.

Toggles:
  VIDEO_PROVIDER   – "mock" | "runpod"  (default: mock)
  LLM_PROVIDER     – "mock" | "runpod"  (default: same as VIDEO_PROVIDER if unset)
  RUNPOD_MUSETALK_URL
  RUNPOD_LLM_URL
  RUNPOD_API_KEY
  RUNPOD_TRAINING_URL
  RUNPOD_TRAINING_API_KEY
  WEIGHTS_STORAGE_BUCKET
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["mock", "runpod"]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Provider selection ---
    video_provider: ProviderName = Field(
        default="mock",
        validation_alias="VIDEO_PROVIDER",
        description="Video generation backend: mock | runpod",
    )
    llm_provider: ProviderName | None = Field(
        default=None,
        validation_alias="LLM_PROVIDER",
        description="LLM backend: mock | runpod (defaults to VIDEO_PROVIDER when unset)",
    )

    # --- RunPod endpoints / auth ---
    runpod_musetalk_url: str = Field(
        default="",
        validation_alias="RUNPOD_MUSETALK_URL",
        description="Base URL for MuseTalk RunPod serverless/pod endpoint",
    )
    runpod_llm_url: str = Field(
        default="",
        validation_alias="RUNPOD_LLM_URL",
        description="Base URL for LLM RunPod serverless/pod endpoint",
    )
    runpod_api_key: str = Field(
        default="",
        validation_alias="RUNPOD_API_KEY",
        description="RunPod API key (Authorization: Bearer …)",
    )

    # --- Training / fine-tune (Kohya_ss, Unsloth, XTTS) ---
    runpod_training_url: str = Field(
        default="",
        validation_alias="RUNPOD_TRAINING_URL",
        description="Base URL for remote RunPod training jobs (LoRA / Unsloth / XTTS)",
    )
    runpod_training_api_key: str = Field(
        default="",
        validation_alias="RUNPOD_TRAINING_API_KEY",
        description=(
            "API key for training endpoint; falls back to RUNPOD_API_KEY when empty"
        ),
    )
    weights_storage_bucket: str = Field(
        default="",
        validation_alias="WEIGHTS_STORAGE_BUCKET",
        description="Object-storage bucket/prefix for trained weights & datasets",
    )

    # --- HTTP client behaviour ---
    runpod_timeout_seconds: float = Field(
        default=30.0,
        validation_alias="RUNPOD_TIMEOUT_SECONDS",
        description="HTTP timeout for RunPod requests",
    )
    runpod_fallback_to_mock: bool = Field(
        default=True,
        validation_alias="RUNPOD_FALLBACK_TO_MOCK",
        description="On RunPod network/timeout errors, fall back to mock providers",
    )
    runpod_connect_timeout_seconds: float = Field(
        default=5.0,
        validation_alias="RUNPOD_CONNECT_TIMEOUT_SECONDS",
    )

    @field_validator("video_provider", "llm_provider", mode="before")
    @classmethod
    def _normalize_provider(cls, v: object) -> object:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            return v.strip().lower()
        return v

    def resolved_llm_provider(self) -> ProviderName:
        """LLM provider, falling back to VIDEO_PROVIDER when LLM_PROVIDER is unset."""
        if self.llm_provider is None:
            return self.video_provider
        return self.llm_provider

    def resolved_training_api_key(self) -> str:
        """Training key, falling back to the shared RUNPOD_API_KEY."""
        return self.runpod_training_api_key or self.runpod_api_key

    def runpod_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.runpod_api_key:
            headers["Authorization"] = f"Bearer {self.runpod_api_key}"
        return headers

    def runpod_training_headers(self) -> dict[str, str]:
        """Auth headers for the training endpoint (dedicated key preferred)."""
        headers = {"Content-Type": "application/json"}
        key = self.resolved_training_api_key()
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return headers


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton. Call `get_settings.cache_clear()` after env changes."""
    return Settings()


def reload_settings() -> Settings:
    """Clear cache and re-read environment (used by smoke tests / hot reload)."""
    get_settings.cache_clear()
    return get_settings()
