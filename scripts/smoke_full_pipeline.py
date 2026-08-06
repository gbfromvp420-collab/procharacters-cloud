#!/usr/bin/env python3
"""
Full-pipeline smoke: weight registry → dynamic character/LoRA swap →
WebRTC session + chat perform → RunPod-shaped inference payloads with weights.

Verifies end-to-end that trained model weights flow into live inference.
"""

from __future__ import annotations

import asyncio
import base64
import os
import struct
import sys
import tempfile
import zlib
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx

# ---------------------------------------------------------------------------
# Synthetic media helpers
# ---------------------------------------------------------------------------


def _minimal_png(width: int = 512, height: int = 512) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = b"\x00" + b"\x00\x00\x00"
    idat = zlib.compress(row)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _minimal_wav(duration_ms: int = 1000, sample_rate: int = 16000) -> bytes:
    channels, bits = 1, 16
    n_samples = int(sample_rate * duration_ms / 1000)
    data_size = n_samples * channels * (bits // 8)
    byte_rate = sample_rate * channels * (bits // 8)
    block_align = channels * (bits // 8)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits,
        b"data",
        data_size,
    )
    return header + (b"\x00" * data_size)


# ---------------------------------------------------------------------------
# Env helpers
# ---------------------------------------------------------------------------


def _set_env(**kwargs: str | None) -> dict[str, str | None]:
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
    from app.services.trainer.registry import reset_weight_registry
    from app.services.video.factory import reset_video_provider_cache

    reload_settings()
    reset_video_provider_cache()
    reset_llm_provider_cache()
    reset_weight_registry()


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

    # ==================================================================
    # 1) Weight registry index + resolve
    # ==================================================================
    with tempfile.TemporaryDirectory(prefix="weights-reg-") as tmp:
        prev = _set_env(
            WEIGHTS_STORAGE_BUCKET="procharacters-weights",
            VIDEO_PROVIDER="mock",
            LLM_PROVIDER="mock",
            RUNPOD_TRAINING_URL="",
        )
        try:
            _reload()
            from app.core.config import get_settings
            from app.services.trainer.registry import (
                WeightKind,
                WeightRegistry,
                get_weight_registry,
            )

            reg = WeightRegistry(get_settings(), root_dir=tmp)
            e_lora = reg.register(
                character_id="nova",
                kind=WeightKind.VISUAL_LORA,
                lora_id="lora-nova-v1",
                weight_id="lora-nova-v1",
                trigger_word="novax",
                base_model="sd15",
            )
            e_llm = reg.register(
                character_id="nova",
                kind=WeightKind.LLM,
                weight_id="llm-nova-v1",
                uri="s3://procharacters-weights/weights/nova/llm/llm-nova-v1",
                base_model="unsloth/llama-3-8b",
            )
            e_voice = reg.register(
                character_id="nova",
                kind=WeightKind.VOICE,
                weight_id="voice-nova-v1",
            )
            # Second LoRA for swap test
            reg.register(
                character_id="nova",
                kind=WeightKind.VISUAL_LORA,
                lora_id="lora-nova-v2",
                weight_id="lora-nova-v2",
                trigger_word="novax2",
                set_active=False,
            )

            failures.check(
                "procharacters-weights" in e_lora.uri, f"lora uri={e_lora.uri}"
            )
            failures.check(e_llm.uri.endswith("llm-nova-v1"), e_llm.uri)
            failures.check(e_voice.kind == WeightKind.VOICE, e_voice.kind)

            resolved = reg.resolve("nova")
            failures.check(
                resolved.visual_lora is not None
                and resolved.visual_lora.weight_id == "lora-nova-v1",
                f"active visual={resolved.visual_lora}",
            )
            failures.check(resolved.llm is not None, "missing llm")
            failures.check(resolved.voice is not None, "missing voice")
            payload = resolved.to_inference_payload()
            failures.check(
                payload.get("visual_lora_uri") == e_lora.uri,
                f"inference visual={payload}",
            )
            failures.check(
                payload.get("llm_weights_uri") == e_llm.uri, f"inference llm={payload}"
            )

            # Hot-swap via lora_id
            swapped = reg.resolve("nova", lora_id="lora-nova-v2")
            failures.check(
                swapped.visual_lora is not None
                and swapped.visual_lora.weight_id == "lora-nova-v2",
                f"swap failed: {swapped.visual_lora}",
            )
            failures.check(swapped.lora_id == "lora-nova-v2", swapped.lora_id)
            # LLM/voice still from active character bindings
            failures.check(
                swapped.llm is not None and swapped.llm.weight_id == "llm-nova-v1",
                "llm should remain bound",
            )

            print("  [ok] weight registry register / resolve / lora swap")
        finally:
            _restore_env(prev)
            _reload()

    # ==================================================================
    # 2) MediaBridge forwards weights into provider requests (mock)
    # ==================================================================
    with tempfile.TemporaryDirectory(prefix="weights-bridge-") as tmp:
        prev = _set_env(
            WEIGHTS_STORAGE_BUCKET="procharacters-weights",
            VIDEO_PROVIDER="mock",
            LLM_PROVIDER="mock",
        )
        try:
            _reload()
            from app.core.config import get_settings
            from app.media_bridge import MediaBridge
            from app.services.trainer.registry import (
                WeightKind,
                get_weight_registry,
                reset_weight_registry,
            )

            reset_weight_registry()
            reg = get_weight_registry(get_settings(), root_dir=tmp, force_new=True)
            reg.register(
                character_id="aria",
                kind=WeightKind.VISUAL_LORA,
                lora_id="lora-aria",
                weight_id="lora-aria",
                trigger_word="ariax",
            )
            reg.register(
                character_id="aria",
                kind=WeightKind.LLM,
                weight_id="llm-aria",
                base_model="custom-aria",
            )

            bridge = MediaBridge(get_settings())
            result = await bridge.perform(
                session_id="s-bridge",
                character_id="aria",
                message="hello weights",
                generate_video=True,
                lora_id="lora-aria",
            )
            failures.check(result.ok, f"bridge perform: {result.error}")
            failures.check(result.lora_id == "lora-aria", f"lora_id={result.lora_id}")
            failures.check(
                "visual_lora_uri" in result.weights, f"weights={result.weights}"
            )
            failures.check(
                result.performance.get("lora_id") == "lora-aria",
                result.performance,
            )
            failures.check(
                result.llm.get("llm_weights_uri") is not None,
                f"llm block={result.llm}",
            )
            print("  [ok] MediaBridge resolves + attaches character weights")
        finally:
            _restore_env(prev)
            _reload()

    # ==================================================================
    # 3) RunPod providers include weight fields in HTTP payloads
    # ==================================================================
    captured: dict[str, Any] = {"video": None, "llm": None}

    async def _handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = request.read()
        import json as _json

        try:
            data = _json.loads(body.decode() if body else b"{}")
        except Exception:
            data = {}
        if "musetalk" in str(request.url) or path.endswith("/runsync") or path.endswith(
            "/run"
        ):
            if "musetalk" in str(request.url) or "video" in str(request.url):
                captured["video"] = data
                return httpx.Response(
                    200,
                    json={
                        "id": "vid-1",
                        "status": "COMPLETED",
                        "output": {
                            "video_url": "https://cdn.example/out.mp4",
                            "duration_ms": 3000,
                        },
                    },
                )
        if "chat/completions" in path or path.endswith("/runsync"):
            captured["llm"] = data
            return httpx.Response(
                200,
                json={
                    "model": "runpod-char",
                    "choices": [
                        {
                            "message": {
                                "role": "assistant",
                                "content": "Weighted reply",
                            }
                        }
                    ],
                },
            )
        if path.endswith("/runsync") or path.endswith("/run"):
            # generic
            if captured["video"] is None and "character_id" in str(data):
                captured["video"] = data
            return httpx.Response(
                200,
                json={
                    "id": "job-x",
                    "status": "COMPLETED",
                    "output": {"video_url": "https://cdn.example/x.mp4"},
                },
            )
        return httpx.Response(404, json={"error": "nf"})

    transport = httpx.MockTransport(_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://runpod.test"
    ) as client:
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
            WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        )
        video = MuseTalkRunPodProvider(cfg, client=client)
        llm = RunPodLLMProvider(cfg, client=client)

        vres = await video.generate(
            VideoGenerateRequest(
                session_id="s1",
                character_id="nova",
                text="hi",
                lora_id="lora-nova-v2",
                visual_lora_uri="s3://procharacters-weights/weights/nova/visual_lora/lora-nova-v2",
                voice_model_uri="s3://procharacters-weights/weights/nova/voice/v1",
                extra={
                    "weights": {
                        "character_id": "nova",
                        "lora_id": "lora-nova-v2",
                        "visual_lora_uri": "s3://procharacters-weights/weights/nova/visual_lora/lora-nova-v2",
                    }
                },
            )
        )
        failures.check(vres.ok, f"video gen: {vres}")
        failures.check(
            vres.meta.get("lora_id") == "lora-nova-v2", f"video meta={vres.meta}"
        )
        vin = (captured.get("video") or {}).get("input") or captured.get("video") or {}
        failures.check(
            vin.get("lora_id") == "lora-nova-v2"
            or vin.get("visual_lora_uri") is not None,
            f"video payload missing weights: {captured.get('video')}",
        )
        failures.check(
            vin.get("character_id") == "nova",
            f"video character_id={vin.get('character_id')}",
        )

        lres = await llm.complete(
            LLMRequest(
                session_id="s1",
                character_id="nova",
                messages=[LLMMessage(role="user", content="ping")],
                lora_id="lora-nova-v2",
                llm_weights_uri="s3://procharacters-weights/weights/nova/llm/llm-nova-v1",
                extra={
                    "weights": {
                        "llm_weights_uri": "s3://procharacters-weights/weights/nova/llm/llm-nova-v1",
                        "llm_base_model": "unsloth/llama-3-8b",
                    }
                },
            )
        )
        failures.check(lres.ok, f"llm: {lres}")
        failures.check(lres.text == "Weighted reply", lres.text)
        lbody = captured.get("llm") or {}
        # Could be openai-shaped or runsync input
        llm_has_weights = (
            lbody.get("llm_weights_uri")
            or lbody.get("adapter_uri")
            or (lbody.get("extra_body") or {}).get("llm_weights_uri")
            or (lbody.get("input") or {}).get("llm_weights_uri")
            or lbody.get("character_id") == "nova"
        )
        failures.check(bool(llm_has_weights), f"llm payload missing weights: {lbody}")
        failures.check(
            lbody.get("character_id") == "nova"
            or (lbody.get("input") or {}).get("character_id") == "nova"
            or (lbody.get("extra_body") or {}).get("character_id") == "nova",
            f"llm character_id missing: {lbody}",
        )
        print("  [ok] RunPod MuseTalk + LLM payloads carry character weights")

    # ==================================================================
    # 4) Multipart dataset upload
    # ==================================================================
    prev = _set_env(
        WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        VIDEO_PROVIDER="mock",
        LLM_PROVIDER="mock",
        RUNPOD_TRAINING_URL="",
    )
    try:
        _reload()
        import multipart  # noqa: F401
        from fastapi.testclient import TestClient

        from app.main import app
        from app.services.trainer.registry import reset_weight_registry
        from app.services.trainer.runpod_job import reset_mock_jobs

        reset_weight_registry()
        reset_mock_jobs()

        with TestClient(app) as tc:
            # multipart binary upload
            png = _minimal_png(512, 512)
            wav = _minimal_wav(1500)
            r = tc.post(
                "/api/v1/trainer/dataset/upload",
                data={
                    "character_id": "nova",
                    "trigger_word": "novax",
                    "extra_tags": "portrait, studio",
                    "captions_json": '{"face.png":"close-up portrait"}',
                },
                files=[
                    ("files", ("face.png", png, "image/png")),
                    ("files", ("line.wav", wav, "audio/wav")),
                ],
            )
            failures.check(
                r.status_code == 200,
                f"multipart upload status={r.status_code} {r.text[:300]}",
            )
            ds = r.json()
            failures.check(ds.get("ok") is True, ds)
            failures.check(ds.get("image_count") == 1, ds)
            failures.check(ds.get("audio_count") == 1, ds)
            dataset_id = ds.get("dataset_id")
            failures.check(bool(dataset_id), "no dataset_id")

            # start mock training → auto-register weights
            r = tc.post(
                "/api/v1/trainer/start-job",
                json={
                    "training_kind": "kohya_ss",
                    "character_id": "nova",
                    "dataset_id": dataset_id,
                    "trigger_word": "novax",
                    "mock": True,
                    "register_on_complete": True,
                },
            )
            failures.check(r.status_code == 200, f"start-job={r.status_code} {r.text}")
            job = r.json()
            failures.check(job.get("ok") is True, job)
            failures.check(
                job.get("registered_weight") is not None
                or job.get("weights_uri") is not None,
                f"expected registered weight: {job}",
            )
            lora_id = (job.get("registered_weight") or {}).get("lora_id") or job.get(
                "job_id"
            )

            # also register llm + voice for full swap
            r = tc.post(
                "/api/v1/trainer/weights/register",
                json={
                    "character_id": "nova",
                    "kind": "llm",
                    "weight_id": "llm-nova-live",
                    "base_model": "unsloth/llama-3-8b",
                    "set_active": True,
                },
            )
            failures.check(r.status_code == 200, f"reg llm={r.status_code} {r.text}")

            r = tc.post(
                "/api/v1/trainer/weights/register",
                json={
                    "character_id": "nova",
                    "kind": "voice",
                    "weight_id": "voice-nova-live",
                    "set_active": True,
                },
            )
            failures.check(r.status_code == 200, f"reg voice={r.status_code}")

            r = tc.get(
                "/api/v1/trainer/weights/resolve",
                params={"character_id": "nova", "lora_id": lora_id},
            )
            failures.check(r.status_code == 200, r.text)
            resolved = r.json()
            failures.check(resolved.get("ok") is True, resolved)
            failures.check(
                resolved.get("inference", {}).get("character_id") == "nova",
                resolved,
            )
            print("  [ok] multipart upload + mock train + weight register")

            # ----------------------------------------------------------
            # 5) WebRTC session + chat perform weight swap
            # ----------------------------------------------------------
            r = tc.post(
                "/api/v1/webrtc/session",
                json={
                    "session_id": "sess-full-1",
                    "character_id": "nova",
                    "lora_id": lora_id,
                },
            )
            failures.check(r.status_code == 200, f"session post={r.status_code} {r.text}")
            sess = r.json()
            failures.check(sess.get("character_id") == "nova", sess)
            failures.check(sess.get("lora_id") == lora_id, sess)
            failures.check(
                isinstance(sess.get("weights"), dict)
                and sess["weights"].get("character_id") == "nova",
                f"session weights={sess.get('weights')}",
            )

            r = tc.get("/api/v1/webrtc/session/sess-full-1")
            failures.check(r.status_code == 200, r.text)
            g = r.json()
            failures.check(g.get("lora_id") == lora_id, g)

            # offer also accepts lora_id
            r = tc.post(
                "/api/v1/webrtc/offer",
                json={
                    "session_id": "sess-full-1",
                    "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
                    "type": "offer",
                    "character_id": "nova",
                    "lora_id": lora_id,
                },
            )
            failures.check(r.status_code == 200, f"offer={r.status_code} {r.text}")
            ans = r.json()
            failures.check(ans.get("character_id") == "nova", ans)
            failures.check(ans.get("lora_id") == lora_id, ans)

            # chat perform via versioned path
            r = tc.post(
                "/api/v1/chat/perform",
                json={
                    "session_id": "sess-full-1",
                    "character_id": "nova",
                    "lora_id": lora_id,
                    "message": "swap check",
                },
            )
            failures.check(
                r.status_code == 200, f"chat perform={r.status_code} {r.text}"
            )
            chat = r.json()
            failures.check(chat.get("ok") is True, chat)
            failures.check(chat.get("character_id") == "nova", chat)
            failures.check(chat.get("lora_id") == lora_id, chat)
            failures.check(
                isinstance(chat.get("weights"), dict)
                and (
                    chat["weights"].get("lora_id") == lora_id
                    or chat["weights"].get("visual_lora_uri")
                ),
                f"chat weights={chat.get('weights')}",
            )
            failures.check(
                chat.get("performance", {}).get("lora_id") == lora_id
                or "visual_lora_uri" in (chat.get("performance") or {}),
                chat.get("performance"),
            )
            failures.check("nova" in chat.get("reply", ""), chat.get("reply"))

            # Dynamic swap to a different lora mid-session
            r = tc.post(
                "/api/v1/trainer/weights/register",
                json={
                    "character_id": "nova",
                    "kind": "visual_lora",
                    "weight_id": "lora-nova-alt",
                    "lora_id": "lora-nova-alt",
                    "trigger_word": "novalt",
                    "set_active": False,
                },
            )
            failures.check(r.status_code == 200, r.text)

            r = tc.post(
                "/api/v1/webrtc/session",
                json={
                    "session_id": "sess-full-1",
                    "character_id": "nova",
                    "lora_id": "lora-nova-alt",
                },
            )
            failures.check(r.status_code == 200, r.text)
            sess2 = r.json()
            failures.check(sess2.get("lora_id") == "lora-nova-alt", sess2)

            r = tc.post(
                "/api/v1/chat/perform",
                json={
                    "session_id": "sess-full-1",
                    "character_id": "nova",
                    "lora_id": "lora-nova-alt",
                    "message": "new face",
                },
            )
            failures.check(r.status_code == 200, r.text)
            chat2 = r.json()
            failures.check(chat2.get("lora_id") == "lora-nova-alt", chat2)
            failures.check(
                (chat2.get("weights") or {}).get("lora_id") == "lora-nova-alt"
                or "lora-nova-alt"
                in str((chat2.get("weights") or {}).get("visual_lora_uri") or ""),
                f"swapped weights={chat2.get('weights')}",
            )
            print("  [ok] WebRTC session + chat perform dynamic LoRA swap")

            # JSON dataset path still works
            png_b64 = base64.b64encode(_minimal_png(400, 400)).decode("ascii")
            r = tc.post(
                "/api/v1/trainer/dataset",
                json={
                    "character_id": "nova",
                    "trigger_word": "novax",
                    "assets": [{"filename": "b.png", "content_b64": png_b64}],
                },
            )
            failures.check(r.status_code == 200, r.text)
            print("  [ok] JSON base64 dataset path still works")

            # health flags
            r = tc.get("/health")
            failures.check(r.status_code == 200, r.text)
            failures.check("training_configured" in r.json(), r.json())

    finally:
        _restore_env(prev)
        _reload()

    # ==================================================================
    # Report
    # ==================================================================
    if not failures.ok():
        print("SMOKE FULL PIPELINE FAILED")
        for item in failures.items:
            print(f"  - {item}")
        return 1

    print("SMOKE FULL PIPELINE OK")
    print("  weight registry + lora hot-swap")
    print("  MediaBridge attaches weights to inference")
    print("  RunPod providers forward character/lora weight URIs")
    print("  multipart dataset upload")
    print("  WebRTC session + /api/v1/chat/perform dynamic swap")
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
