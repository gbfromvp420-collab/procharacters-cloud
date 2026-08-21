"""
RunPod MuseTalk video provider — async HTTPX client with streaming support.

Expects a RunPod serverless-style endpoint:
  POST {RUNPOD_MUSETALK_URL}/run   or  /runsync
  GET  {RUNPOD_MUSETALK_URL}/stream/{job_id}  (optional NDJSON / SSE)
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.services.video.base import VideoGenerateRequest, VideoGenerateResult

logger = logging.getLogger(__name__)


class MuseTalkRunPodProvider:
    """Remote MuseTalk worker on RunPod (GPU)."""

    name = "runpod"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._owns_client = client is None
        timeout = httpx.Timeout(
            self.settings.runpod_timeout_seconds,
            connect=self.settings.runpod_connect_timeout_seconds,
        )
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            headers=self.settings.runpod_headers(),
            follow_redirects=True,
        )

    @property
    def base_url(self) -> str:
        return (self.settings.runpod_musetalk_url or "").rstrip("/")

    def _ensure_configured(self) -> None:
        if not self.base_url:
            raise RuntimeError(
                "RUNPOD_MUSETALK_URL is not configured for video_provider=runpod"
            )

    def _weight_fields(self, request: VideoGenerateRequest) -> dict[str, Any]:
        """Character / LoRA weight refs forwarded to the MuseTalk worker."""
        fields: dict[str, Any] = {}
        if request.lora_id:
            fields["lora_id"] = request.lora_id
        if request.visual_lora_uri:
            fields["visual_lora_uri"] = request.visual_lora_uri
            fields["lora_uri"] = request.visual_lora_uri
        if request.voice_model_uri:
            fields["voice_model_uri"] = request.voice_model_uri
            fields["xtts_uri"] = request.voice_model_uri
        # Allow callers to pass a pre-built weights block via extra
        weights = (request.extra or {}).get("weights")
        if isinstance(weights, dict):
            fields["weights"] = weights
        return fields

    async def generate(self, request: VideoGenerateRequest) -> VideoGenerateResult:
        self._ensure_configured()
        extra = dict(request.extra or {})
        # Pull weight keys out of extra so they are not double-nested oddly
        extra.pop("weights", None)
        payload = {
            "input": {
                "session_id": request.session_id,
                "character_id": request.character_id,
                "audio_url": request.audio_url,
                "audio_b64": request.audio_b64,
                "text": request.text,
                "avatar_url": request.avatar_url,
                **self._weight_fields(request),
                **extra,
            }
        }

        # Prefer /runsync when available; fall back to /run.
        url = f"{self.base_url}/runsync"
        try:
            response = await self._client.post(url, json=payload)
            if response.status_code == 404:
                url = f"{self.base_url}/run"
                response = await self._client.post(url, json=payload)
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            logger.warning("MuseTalk RunPod timeout: %s", exc)
            return VideoGenerateResult(
                ok=False,
                provider=self.name,
                error=f"timeout: {exc}",
                meta={"url": url},
            )
        except httpx.HTTPError as exc:
            logger.warning("MuseTalk RunPod HTTP error: %s", exc)
            return VideoGenerateResult(
                ok=False,
                provider=self.name,
                error=f"http_error: {exc}",
                meta={"url": url},
            )

        data = _safe_json(response)
        output = data.get("output") if isinstance(data.get("output"), dict) else data
        job_id = (
            data.get("id")
            or data.get("job_id")
            or (output or {}).get("job_id")
            or f"runpod-{uuid.uuid4().hex[:12]}"
        )
        video_url = None
        if isinstance(output, dict):
            video_url = output.get("video_url") or output.get("url")
        status = str(data.get("status") or output.get("status") or "").upper()
        ok = status in ("", "COMPLETED", "SUCCESS", "DONE") and bool(
            video_url or data.get("output") is not None
        )
        # If RunPod accepted the job but returned no video yet, still surface job id.
        if status in ("IN_QUEUE", "IN_PROGRESS"):
            ok = False

        return VideoGenerateResult(
            ok=ok or bool(video_url),
            provider=self.name,
            job_id=str(job_id) if job_id else None,
            video_url=video_url,
            duration_ms=(output or {}).get("duration_ms") if isinstance(output, dict) else None,
            meta={
                "raw_status": data.get("status"),
                "url": url,
                "character_id": request.character_id,
                "lora_id": request.lora_id,
                "visual_lora_uri": request.visual_lora_uri,
            },
            error=None if (ok or video_url) else (data.get("error") or status or "no_video"),
        )

    async def stream_events(
        self, request: VideoGenerateRequest
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Stream NDJSON progress from RunPod when supported.

        Falls back to a single completed/failed event from `generate()`.
        """
        self._ensure_configured()
        stream_url = f"{self.base_url}/stream"
        extra = dict(request.extra or {})
        extra.pop("weights", None)
        payload = {
            "input": {
                "session_id": request.session_id,
                "character_id": request.character_id,
                "text": request.text,
                "audio_url": request.audio_url,
                "avatar_url": request.avatar_url,
                **self._weight_fields(request),
                **extra,
            }
        }

        try:
            async with self._client.stream(
                "POST",
                stream_url,
                json=payload,
                headers={**self.settings.runpod_headers(), "Accept": "application/x-ndjson"},
            ) as response:
                if response.status_code >= 400:
                    # Endpoint may not support streaming — fall back.
                    logger.info(
                        "MuseTalk stream unavailable (%s); falling back to generate()",
                        response.status_code,
                    )
                    result = await self.generate(request)
                    yield _result_event(result)
                    return

                async for line in response.aiter_lines():
                    if not line or not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        yield {"event": "raw", "provider": self.name, "data": line}
                        continue
                    if isinstance(event, dict):
                        event.setdefault("provider", self.name)
                        yield event
                    else:
                        yield {"event": "data", "provider": self.name, "data": event}
        except httpx.TimeoutException as exc:
            yield {
                "event": "error",
                "provider": self.name,
                "error": f"timeout: {exc}",
            }
        except httpx.HTTPError as exc:
            yield {
                "event": "error",
                "provider": self.name,
                "error": f"http_error: {exc}",
            }

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
        return data if isinstance(data, dict) else {"output": data}
    except ValueError:
        return {"raw": response.text}


def _result_event(result: VideoGenerateResult) -> dict[str, Any]:
    return {
        "event": "completed" if result.ok else "error",
        "provider": result.provider,
        "job_id": result.job_id,
        "video_url": result.video_url,
        "error": result.error,
        "meta": result.meta,
    }
