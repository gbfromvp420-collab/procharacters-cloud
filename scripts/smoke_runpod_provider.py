#!/usr/bin/env python3
"""
Smoke test: VIDEO_PROVIDER / RunPod env toggles, factory selection,
timeout + fallback behaviour — without requiring a live GPU pod.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _set_env(**kwargs: str | None) -> dict[str, str | None]:
    """Set env vars; return previous values for restore."""
    prev: dict[str, str | None] = {}
    for key, value in kwargs.items():
        prev[key] = os.environ.get(key)
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    return prev


def _restore_env(prev: dict[str, str | None]) -> None:
    for key, value in prev.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def _reload() -> None:
    from app.core.config import reload_settings
    from app.services.llm.factory import reset_llm_provider_cache
    from app.services.video.factory import reset_video_provider_cache

    reload_settings()
    reset_video_provider_cache()
    reset_llm_provider_cache()


class Failures:
    def __init__(self) -> None:
        self.items: list[str] = []

    def check(self, cond: bool, msg: str) -> None:
        if not cond:
            self.items.append(msg)

    def ok(self) -> bool:
        return not self.items


async def _run() -> int:
    failures = Failures()

    # ------------------------------------------------------------------
    # 1) Default / mock provider selection
    # ------------------------------------------------------------------
    prev = _set_env(
        VIDEO_PROVIDER="mock",
        LLM_PROVIDER="mock",
        RUNPOD_MUSETALK_URL=None,
        RUNPOD_LLM_URL=None,
        RUNPOD_API_KEY=None,
        RUNPOD_FALLBACK_TO_MOCK="true",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.services.llm.factory import get_llm_provider
        from app.services.llm.mock import MockLLMProvider
        from app.services.video.factory import get_video_provider
        from app.services.video.mock import MockVideoProvider

        cfg = get_settings()
        failures.check(cfg.video_provider == "mock", f"video_provider={cfg.video_provider}")
        failures.check(
            cfg.resolved_llm_provider() == "mock",
            f"llm_provider={cfg.resolved_llm_provider()}",
        )

        vp = get_video_provider(force_new=True)
        lp = get_llm_provider(force_new=True)
        failures.check(isinstance(vp, MockVideoProvider), f"video type={type(vp)}")
        failures.check(isinstance(lp, MockLLMProvider), f"llm type={type(lp)}")
        failures.check(vp.name == "mock", f"video name={vp.name}")
        failures.check(lp.name == "mock", f"llm name={lp.name}")

        from app.media_bridge import MediaBridge

        bridge = MediaBridge(cfg)
        result = await bridge.perform(
            session_id="smoke-mock",
            character_id="char-a",
            message="hello mock",
            generate_video=True,
        )
        failures.check(result.ok, f"mock perform not ok: {result.error}")
        failures.check(result.provider_llm == "mock", f"provider_llm={result.provider_llm}")
        failures.check(
            result.provider_video == "mock", f"provider_video={result.provider_video}"
        )
        failures.check(not result.fallback_used, "unexpected fallback on mock")
        failures.check(bool(result.reply), "empty mock reply")
        print("  [ok] mock providers via VIDEO_PROVIDER=mock")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 2) runpod selection when URLs + key present
    # ------------------------------------------------------------------
    prev = _set_env(
        VIDEO_PROVIDER="runpod",
        LLM_PROVIDER="runpod",
        RUNPOD_MUSETALK_URL="https://api.runpod.ai/v2/musetalk-fake",
        RUNPOD_LLM_URL="https://api.runpod.ai/v2/llm-fake",
        RUNPOD_API_KEY="rp_test_key_smoke",
        RUNPOD_TIMEOUT_SECONDS="2",
        RUNPOD_CONNECT_TIMEOUT_SECONDS="1",
        RUNPOD_FALLBACK_TO_MOCK="true",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.services.llm.factory import get_llm_provider
        from app.services.llm.runpod_llm import RunPodLLMProvider
        from app.services.video.factory import get_video_provider
        from app.services.video.musetalk_runpod import MuseTalkRunPodProvider

        cfg = get_settings()
        failures.check(cfg.video_provider == "runpod", f"video_provider={cfg.video_provider}")
        failures.check(cfg.runpod_api_key == "rp_test_key_smoke", "api key not loaded")
        failures.check(
            "musetalk-fake" in cfg.runpod_musetalk_url,
            f"musetalk url={cfg.runpod_musetalk_url}",
        )
        failures.check(
            "llm-fake" in cfg.runpod_llm_url, f"llm url={cfg.runpod_llm_url}"
        )

        vp = get_video_provider(force_new=True)
        lp = get_llm_provider(force_new=True)
        failures.check(
            isinstance(vp, MuseTalkRunPodProvider), f"video type={type(vp).__name__}"
        )
        failures.check(isinstance(lp, RunPodLLMProvider), f"llm type={type(lp).__name__}")
        failures.check(vp.name == "runpod", f"video name={vp.name}")
        failures.check(lp.name == "runpod", f"llm name={lp.name}")

        headers = cfg.runpod_headers()
        failures.check(
            headers.get("Authorization") == "Bearer rp_test_key_smoke",
            f"auth header={headers.get('Authorization')}",
        )
        print("  [ok] runpod providers selected when URLs configured")
    finally:
        await _aclose_cached()
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 3) runpod without URL falls back to mock at factory level
    # ------------------------------------------------------------------
    prev = _set_env(
        VIDEO_PROVIDER="runpod",
        LLM_PROVIDER="runpod",
        RUNPOD_MUSETALK_URL="",
        RUNPOD_LLM_URL="",
        RUNPOD_API_KEY="x",
    )
    try:
        _reload()
        from app.services.llm.factory import get_llm_provider
        from app.services.llm.mock import MockLLMProvider
        from app.services.video.factory import get_video_provider
        from app.services.video.mock import MockVideoProvider

        vp = get_video_provider(force_new=True)
        lp = get_llm_provider(force_new=True)
        failures.check(isinstance(vp, MockVideoProvider), "empty musetalk url should mock video")
        failures.check(isinstance(lp, MockLLMProvider), "empty llm url should mock llm")
        print("  [ok] empty RunPod URLs degrade to mock at factory")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 4) Network timeout → graceful error + bridge fallback to mock
    # ------------------------------------------------------------------
    # Use a non-routable / blackhole address with short connect timeout.
    prev = _set_env(
        VIDEO_PROVIDER="runpod",
        LLM_PROVIDER="runpod",
        RUNPOD_MUSETALK_URL="http://172.16.0.1:9",  # discard / unreachable
        RUNPOD_LLM_URL="http://172.16.0.1:9",
        RUNPOD_API_KEY="rp_test",
        RUNPOD_TIMEOUT_SECONDS="1",
        RUNPOD_CONNECT_TIMEOUT_SECONDS="0.3",
        RUNPOD_FALLBACK_TO_MOCK="true",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.media_bridge import MediaBridge
        from app.services.llm.base import LLMMessage, LLMRequest
        from app.services.llm.runpod_llm import RunPodLLMProvider
        from app.services.video.base import VideoGenerateRequest
        from app.services.video.musetalk_runpod import MuseTalkRunPodProvider

        cfg = get_settings()
        video = MuseTalkRunPodProvider(cfg)
        llm = RunPodLLMProvider(cfg)

        vres = await video.generate(
            VideoGenerateRequest(
                session_id="t1",
                character_id="c1",
                text="hi",
            )
        )
        failures.check(not vres.ok, "expected video timeout/network failure")
        failures.check(
            vres.error is not None
            and ("timeout" in vres.error or "http_error" in vres.error or "Connect" in vres.error),
            f"video error unexpected: {vres.error}",
        )
        failures.check(vres.provider == "runpod", f"video provider={vres.provider}")

        lres = await llm.complete(
            LLMRequest(
                session_id="t1",
                character_id="c1",
                messages=[LLMMessage(role="user", content="ping")],
            )
        )
        failures.check(not lres.ok, "expected llm timeout/network failure")
        failures.check(lres.error is not None, f"llm error missing: {lres}")

        await video.aclose()
        await llm.aclose()

        # Bridge should fall back to mock and still return ok reply
        bridge = MediaBridge(cfg)
        result = await bridge.perform(
            session_id="smoke-fallback",
            character_id="char-b",
            message="fallback please",
            generate_video=True,
        )
        failures.check(result.ok, f"bridge fallback perform failed: {result.error}")
        failures.check(result.fallback_used, "expected fallback_used=True")
        failures.check(
            result.provider_llm == "mock",
            f"after fallback llm should be mock, got {result.provider_llm}",
        )
        failures.check(
            result.provider_video == "mock",
            f"after fallback video should be mock, got {result.provider_video}",
        )
        failures.check("fallback please" in result.reply or "char-b" in result.reply, result.reply)
        print("  [ok] timeouts return errors; MediaBridge falls back to mock")
    finally:
        await _aclose_cached()
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 5) Fallback disabled → surface failure
    # ------------------------------------------------------------------
    prev = _set_env(
        VIDEO_PROVIDER="runpod",
        LLM_PROVIDER="runpod",
        RUNPOD_MUSETALK_URL="http://172.16.0.1:9",
        RUNPOD_LLM_URL="http://172.16.0.1:9",
        RUNPOD_API_KEY="rp_test",
        RUNPOD_TIMEOUT_SECONDS="1",
        RUNPOD_CONNECT_TIMEOUT_SECONDS="0.3",
        RUNPOD_FALLBACK_TO_MOCK="false",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.media_bridge import MediaBridge

        cfg = get_settings()
        failures.check(cfg.runpod_fallback_to_mock is False, "fallback flag not false")
        bridge = MediaBridge(cfg)
        result = await bridge.perform(
            session_id="smoke-nofallback",
            character_id="char-c",
            message="should fail",
            generate_video=True,
        )
        failures.check(not result.ok, "expected failure when fallback disabled")
        failures.check(not result.fallback_used, "fallback_used should be false")
        failures.check(result.provider_llm == "runpod", f"llm={result.provider_llm}")
        print("  [ok] RUNPOD_FALLBACK_TO_MOCK=false surfaces provider errors")
    finally:
        await _aclose_cached()
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 6) LLM_PROVIDER inherits VIDEO_PROVIDER when unset
    # ------------------------------------------------------------------
    prev = _set_env(
        VIDEO_PROVIDER="runpod",
        LLM_PROVIDER=None,
        RUNPOD_MUSETALK_URL="https://example.invalid/m",
        RUNPOD_LLM_URL="https://example.invalid/l",
        RUNPOD_API_KEY="k",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.services.llm.factory import get_llm_provider
        from app.services.llm.runpod_llm import RunPodLLMProvider

        cfg = get_settings()
        failures.check(
            cfg.resolved_llm_provider() == "runpod",
            f"expected llm inherit runpod, got {cfg.resolved_llm_provider()}",
        )
        lp = get_llm_provider(force_new=True)
        failures.check(isinstance(lp, RunPodLLMProvider), type(lp).__name__)
        print("  [ok] LLM_PROVIDER inherits VIDEO_PROVIDER when unset")
    finally:
        await _aclose_cached()
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 7) media_bridge does not import runpod modules (static check)
    # ------------------------------------------------------------------
    bridge_src = (ROOT / "app" / "media_bridge.py").read_text(encoding="utf-8")
    failures.check(
        "musetalk_runpod" not in bridge_src and "runpod_llm" not in bridge_src,
        "media_bridge must not import RunPod modules directly",
    )
    failures.check(
        "get_video_provider" in bridge_src and "get_llm_provider" in bridge_src,
        "media_bridge must use factories",
    )
    print("  [ok] media_bridge stays provider-agnostic")

    # ------------------------------------------------------------------
    # 8) Mocked successful RunPod HTTP responses via custom transport
    # ------------------------------------------------------------------
    async def _mock_handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/runsync") or path.endswith("/run"):
            return httpx.Response(
                200,
                json={
                    "id": "job-video-1",
                    "status": "COMPLETED",
                    "output": {
                        "video_url": "https://cdn.example/clip.mp4",
                        "duration_ms": 3200,
                    },
                },
            )
        if "chat/completions" in path:
            return httpx.Response(
                200,
                json={
                    "model": "runpod-test",
                    "choices": [
                        {"message": {"role": "assistant", "content": "Hello from GPU"}}
                    ],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 4},
                },
            )
        return httpx.Response(404, json={"error": "not found"})

    transport = httpx.MockTransport(_mock_handler)
    async with httpx.AsyncClient(transport=transport, base_url="https://runpod.test") as client:
        from app.core.config import Settings
        from app.services.llm.base import LLMMessage, LLMRequest
        from app.services.llm.runpod_llm import RunPodLLMProvider
        from app.services.video.base import VideoGenerateRequest
        from app.services.video.musetalk_runpod import MuseTalkRunPodProvider

        cfg = Settings(
            VIDEO_PROVIDER="runpod",
            LLM_PROVIDER="runpod",
            RUNPOD_MUSETALK_URL="https://runpod.test/v2/musetalk",
            RUNPOD_LLM_URL="https://runpod.test/v2/llm",
            RUNPOD_API_KEY="k",
        )
        video = MuseTalkRunPodProvider(cfg, client=client)
        llm = RunPodLLMProvider(cfg, client=client)

        vres = await video.generate(
            VideoGenerateRequest(session_id="s", character_id="c", text="hi")
        )
        failures.check(vres.ok, f"mock transport video failed: {vres}")
        failures.check(
            vres.video_url == "https://cdn.example/clip.mp4",
            f"video_url={vres.video_url}",
        )
        failures.check(vres.job_id == "job-video-1", f"job_id={vres.job_id}")

        lres = await llm.complete(
            LLMRequest(
                session_id="s",
                character_id="c",
                messages=[LLMMessage(role="user", content="hi")],
            )
        )
        failures.check(lres.ok, f"mock transport llm failed: {lres}")
        failures.check(lres.text == "Hello from GPU", f"text={lres.text!r}")
        print("  [ok] HTTPX clients parse successful RunPod-shaped responses")

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------
    if not failures.ok():
        print("SMOKE RUNPOD FAILED")
        for item in failures.items:
            print(f"  - {item}")
        return 1

    print("SMOKE RUNPOD OK")
    print("  VIDEO_PROVIDER mock/runpod toggles factories")
    print("  RUNPOD_* env vars load into Settings")
    print("  timeouts / network errors handled")
    print("  fallback to mock when enabled")
    print("  media_bridge unchanged by provider switch")
    return 0


async def _aclose_cached() -> None:
    """Best-effort close of cached providers with HTTP clients."""
    try:
        from app.services.llm.factory import get_llm_provider, reset_llm_provider_cache
        from app.services.video.factory import get_video_provider, reset_video_provider_cache

        for getter in (get_video_provider, get_llm_provider):
            try:
                p = getter()
                aclose = getattr(p, "aclose", None)
                if aclose:
                    await aclose()
            except Exception:
                pass
        reset_video_provider_cache()
        reset_llm_provider_cache()
    except Exception:
        pass


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
