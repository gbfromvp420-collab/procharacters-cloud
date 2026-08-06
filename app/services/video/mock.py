"""In-process mock video provider for local dev and smoke tests."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, AsyncIterator

from app.services.video.base import VideoGenerateRequest, VideoGenerateResult


class MockVideoProvider:
    name = "mock"

    def __init__(self, *, delay_ms: int = 10) -> None:
        self.delay_ms = delay_ms

    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        await asyncio.sleep(self.delay_ms / 1000.0)
        job_id = f"mock-video-{uuid.uuid4().hex[:12]}"
        return VideoGenerateResult(
            ok=True,
            provider=self.name,
            job_id=job_id,
            video_url=f"mock://video/{request.character_id}/{job_id}.mp4",
            mime_type="video/mp4",
            duration_ms=4000,
            meta={
                "session_id": request.session_id,
                "character_id": request.character_id,
                "lora_id": request.lora_id,
                "visual_lora_uri": request.visual_lora_uri,
                "voice_model_uri": request.voice_model_uri,
                "source": "mock",
            },
        )

    async def stream_events(
        self, request: VideoGenerateRequest
    ) -> AsyncIterator[dict[str, Any]]:
        yield {"event": "queued", "provider": self.name, "session_id": request.session_id}
        await asyncio.sleep(self.delay_ms / 1000.0)
        result = await self.generate(request)
        yield {
            "event": "completed",
            "provider": self.name,
            "job_id": result.job_id,
            "video_url": result.video_url,
        }

    async def aclose(self) -> None:
        return None
