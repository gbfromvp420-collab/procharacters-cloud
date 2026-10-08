"""Video provider protocol shared by mock and RunPod implementations."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class VideoGenerateRequest:
    session_id: str
    character_id: str
    audio_url: str | None = None
    audio_b64: str | None = None
    text: str | None = None
    avatar_url: str | None = None
    lora_id: str | None = None
    visual_lora_uri: str | None = None
    voice_model_uri: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class VideoGenerateResult:
    ok: bool
    provider: str
    job_id: str | None = None
    video_url: str | None = None
    mime_type: str = "video/mp4"
    duration_ms: int | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@runtime_checkable
class VideoProvider(Protocol):
    """Async video generation backend."""

    name: str

    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        """Submit a talking-head / clip generation job and wait for a result."""
        ...

    async def stream_events(
        self, request: VideoGenerateRequest
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream progress / chunk events for long-running generation."""
        ...

    async def aclose(self) -> None:
        """Release HTTP clients / resources."""
        ...
