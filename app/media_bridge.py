"""
WebRTC media bridge — provider-agnostic orchestration.

This module talks only to service factories / protocols. Switching
VIDEO_PROVIDER or LLM_PROVIDER must not require edits here.

Character weight resolution uses the trainer WeightRegistry so live
inference can swap visual LoRAs, LLM adapters, and voice packs per
session without hard-coding RunPod modules.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.core.config import Settings, get_settings
from app.services.llm.base import LLMMessage, LLMRequest, LLMResult
from app.services.llm.factory import get_llm_provider
from app.services.llm.mock import MockLLMProvider
from app.services.trainer.registry import CharacterWeights, get_weight_registry
from app.services.video.base import VideoGenerateRequest, VideoGenerateResult
from app.services.video.factory import get_video_provider
from app.services.video.mock import MockVideoProvider

logger = logging.getLogger(__name__)


@dataclass
class PerformResult:
    ok: bool
    reply: str
    performance: dict[str, Any]
    llm: dict[str, Any] = field(default_factory=dict)
    video: dict[str, Any] = field(default_factory=dict)
    provider_video: str = "mock"
    provider_llm: str = "mock"
    fallback_used: bool = False
    error: str | None = None
    character_id: str = "default"
    lora_id: str | None = None
    weights: dict[str, Any] = field(default_factory=dict)


class MediaBridge:
    """
    Bridge between chat/WebRTC session layer and LLM + video backends.

    Factories inject the concrete providers; this class never imports RunPod
    modules directly. Weight URIs come from WeightRegistry.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def resolve_weights(
        self,
        character_id: str,
        *,
        lora_id: str | None = None,
    ) -> CharacterWeights:
        registry = get_weight_registry(self.settings)
        return registry.resolve(character_id, lora_id=lora_id)

    async def perform(
        self,
        *,
        session_id: str,
        character_id: str,
        message: str,
        history: list[dict[str, str]] | None = None,
        avatar_url: str | None = None,
        generate_video: bool = True,
        lora_id: str | None = None,
    ) -> PerformResult:
        """
        Run LLM completion then optional talking-head video generation.

        Active character weights (visual LoRA, LLM adapter, voice) are
        resolved from the registry and forwarded to providers via request
        fields / extra payloads.

        On RunPod timeout/network failure, optionally falls back to mock
        providers when RUNPOD_FALLBACK_TO_MOCK is true.
        """
        fallback_used = False
        llm_provider = get_llm_provider(self.settings)
        video_provider = get_video_provider(self.settings)

        weights = self.resolve_weights(character_id, lora_id=lora_id)
        inference = weights.to_inference_payload()
        resolved_lora = weights.lora_id or lora_id

        messages = _build_messages(character_id, message, history, weights=weights)
        llm_req = LLMRequest(
            session_id=session_id,
            character_id=character_id,
            messages=messages,
            lora_id=resolved_lora,
            llm_weights_uri=weights.llm_weights_uri,
            extra={"weights": inference},
        )

        llm_result = await self._llm_complete_with_fallback(llm_provider, llm_req)
        if llm_result.meta.get("fallback"):
            fallback_used = True
            llm_provider = MockLLMProvider()

        reply = llm_result.text or f"[{character_id}] …"
        performance: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "band": "tease",
            "clip": "idle",
            "emotion": "playful",
            "duration_ms": 4000,
            "character_id": character_id,
            "lora_id": resolved_lora,
        }
        if weights.visual_lora_uri:
            performance["visual_lora_uri"] = weights.visual_lora_uri
        if weights.voice_model_uri:
            performance["voice_model_uri"] = weights.voice_model_uri

        video_result: VideoGenerateResult | None = None
        if generate_video and llm_result.ok:
            video_req = VideoGenerateRequest(
                session_id=session_id,
                character_id=character_id,
                text=reply,
                avatar_url=avatar_url,
                lora_id=resolved_lora,
                visual_lora_uri=weights.visual_lora_uri,
                voice_model_uri=weights.voice_model_uri,
                extra={"weights": inference},
            )
            video_result = await self._video_generate_with_fallback(video_provider, video_req)
            if video_result.meta.get("fallback"):
                fallback_used = True
            if video_result.ok:
                performance["video_url"] = video_result.video_url
                performance["job_id"] = video_result.job_id
                if video_result.duration_ms:
                    performance["duration_ms"] = video_result.duration_ms

        return PerformResult(
            ok=llm_result.ok,
            reply=reply,
            performance=performance,
            llm={
                "provider": llm_result.provider,
                "ok": llm_result.ok,
                "model": llm_result.model,
                "error": llm_result.error,
                "llm_weights_uri": weights.llm_weights_uri,
            },
            video={
                "provider": video_result.provider if video_result else None,
                "ok": video_result.ok if video_result else None,
                "video_url": video_result.video_url if video_result else None,
                "job_id": video_result.job_id if video_result else None,
                "error": video_result.error if video_result else None,
                "visual_lora_uri": weights.visual_lora_uri,
                "voice_model_uri": weights.voice_model_uri,
            },
            provider_video=video_result.provider if video_result else video_provider.name,
            provider_llm=llm_result.provider,
            fallback_used=fallback_used,
            error=llm_result.error,
            character_id=character_id,
            lora_id=resolved_lora,
            weights=inference,
        )

    async def generate_video_only(
        self,
        *,
        session_id: str,
        character_id: str,
        message: str,
        lora_id: str | None = None,
        avatar_url: str | None = None,
    ) -> VideoGenerateResult:
        """Video job only — does not run the product chat LLM."""
        video_provider = get_video_provider(self.settings)
        weights = self.resolve_weights(character_id, lora_id=lora_id)
        resolved_lora = weights.lora_id or lora_id
        request = VideoGenerateRequest(
            session_id=session_id,
            character_id=character_id,
            text=message,
            avatar_url=avatar_url,
            lora_id=resolved_lora,
            visual_lora_uri=weights.visual_lora_uri,
            voice_model_uri=weights.voice_model_uri,
            extra={"weights": weights.to_inference_payload()},
        )
        return await self._video_generate_with_fallback(video_provider, request)

    async def _llm_complete_with_fallback(self, provider: Any, request: LLMRequest) -> LLMResult:
        try:
            result = await provider.complete(request)
        except Exception as exc:  # noqa: BLE001 — boundary to fallback
            logger.warning("LLM provider %s raised: %s", getattr(provider, "name", "?"), exc)
            result = LLMResult(
                ok=False,
                provider=getattr(provider, "name", "unknown"),
                error=str(exc),
            )

        if result.ok:
            return result

        if self.settings.runpod_fallback_to_mock and getattr(provider, "name", "") == "runpod":
            logger.info("Falling back to mock LLM after RunPod failure: %s", result.error)
            mock = MockLLMProvider()
            mock_result = await mock.complete(request)
            mock_result.meta = {**mock_result.meta, "fallback": True, "from": "runpod"}
            return mock_result
        return result

    async def _video_generate_with_fallback(
        self, provider: Any, request: VideoGenerateRequest
    ) -> VideoGenerateResult:
        try:
            result = await provider.generate(request)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Video provider %s raised: %s", getattr(provider, "name", "?"), exc)
            result = VideoGenerateResult(
                ok=False,
                provider=getattr(provider, "name", "unknown"),
                error=str(exc),
            )

        if result.ok:
            return result

        if self.settings.runpod_fallback_to_mock and getattr(provider, "name", "") == "runpod":
            logger.info("Falling back to mock video after RunPod failure: %s", result.error)
            mock = MockVideoProvider()
            mock_result = await mock.generate(request)
            mock_result.meta = {**mock_result.meta, "fallback": True, "from": "runpod"}
            return mock_result
        return result


def _build_messages(
    character_id: str,
    message: str,
    history: list[dict[str, str]] | None,
    *,
    weights: CharacterWeights | None = None,
) -> list[LLMMessage]:
    system = f"You are character '{character_id}'. Reply in character, concise."
    if weights and weights.llm and weights.llm.trigger_word:
        system += f" Trigger/style word: {weights.llm.trigger_word}."
    elif weights and weights.visual_lora and weights.visual_lora.trigger_word:
        system += f" Visual identity: {weights.visual_lora.trigger_word}."
    msgs: list[LLMMessage] = [
        LLMMessage(role="system", content=system),
    ]
    for h in history or []:
        role = h.get("role") or "user"
        content = h.get("content") or ""
        if content:
            msgs.append(LLMMessage(role=role, content=content))
    msgs.append(LLMMessage(role="user", content=message))
    return msgs
