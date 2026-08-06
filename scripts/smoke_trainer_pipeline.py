#!/usr/bin/env python3
"""
Smoke test: trainer dataset validation + mock RunPod training job dispatch.

Verifies:
  - Settings load RUNPOD_TRAINING_URL / RUNPOD_TRAINING_API_KEY / WEIGHTS_STORAGE_BUCKET
  - Image & audio magic-byte validation (accept good, reject bad)
  - Caption generation for avatar LoRA
  - Dataset staging (files + manifest + sidecars)
  - Mock TrainingJobClient start → status → logs → complete
  - HTTPX mock transport for real-shaped RunPod start/status/logs
  - FastAPI routes are registered
"""

from __future__ import annotations

import asyncio
import os
import struct
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx

# ---------------------------------------------------------------------------
# Tiny synthetic media (no Pillow / ffmpeg required)
# ---------------------------------------------------------------------------


def _minimal_png(width: int = 512, height: int = 512) -> bytes:
    """Valid 1x1 PNG scaled dimensions in IHDR only (not a full pixel payload).

    For validation we only need a correct PNG signature + IHDR dimensions.
    We still append an IEND so size is non-trivial.
    """
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    # Minimal RGB rows (filter byte + 3*width zeros) — enough for a decodeable tiny image
    # For large declared sizes, keep pixel payload as 1x1 to stay small; validators
    # only read IHDR for dimensions.
    row = b"\x00" + b"\x00\x00\x00"  # 1 pixel
    idat = zlib.compress(row)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _minimal_wav(
    duration_ms: int = 1000,
    sample_rate: int = 16000,
    channels: int = 1,
    bits: int = 16,
) -> bytes:
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
        16,  # PCM fmt chunk size
        1,  # PCM
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
# Helpers
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

    reload_settings()


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
    # 1) Settings: training env vars
    # ------------------------------------------------------------------
    prev = _set_env(
        RUNPOD_TRAINING_URL="https://api.runpod.ai/v2/training-fake",
        RUNPOD_TRAINING_API_KEY="rp_train_key_smoke",
        WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        RUNPOD_API_KEY="rp_shared_key",
    )
    try:
        _reload()
        from app.core.config import get_settings

        cfg = get_settings()
        failures.check(
            "training-fake" in cfg.runpod_training_url,
            f"runpod_training_url={cfg.runpod_training_url}",
        )
        failures.check(
            cfg.runpod_training_api_key == "rp_train_key_smoke",
            f"training api key={cfg.runpod_training_api_key!r}",
        )
        failures.check(
            cfg.weights_storage_bucket == "procharacters-weights",
            f"bucket={cfg.weights_storage_bucket!r}",
        )
        failures.check(
            cfg.resolved_training_api_key() == "rp_train_key_smoke",
            "resolved_training_api_key should prefer dedicated key",
        )
        headers = cfg.runpod_training_headers()
        failures.check(
            headers.get("Authorization") == "Bearer rp_train_key_smoke",
            f"training auth header={headers.get('Authorization')}",
        )
        print("  [ok] training env vars load into Settings")
    finally:
        _restore_env(prev)
        _reload()

    # Fallback to shared RUNPOD_API_KEY when training key empty
    prev = _set_env(
        RUNPOD_TRAINING_URL="https://example.invalid/train",
        RUNPOD_TRAINING_API_KEY="",
        RUNPOD_API_KEY="rp_shared_only",
        WEIGHTS_STORAGE_BUCKET="s3://my-bucket",
    )
    try:
        _reload()
        from app.core.config import get_settings

        cfg = get_settings()
        failures.check(
            cfg.resolved_training_api_key() == "rp_shared_only",
            f"expected shared key fallback, got {cfg.resolved_training_api_key()!r}",
        )
        print("  [ok] training API key falls back to RUNPOD_API_KEY")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 2) Image / audio validation
    # ------------------------------------------------------------------
    from app.services.trainer.dataset import (
        build_caption,
        validate_asset_bytes,
        validate_audio_bytes,
        validate_image_bytes,
    )

    png = _minimal_png(512, 512)
    img = validate_image_bytes(png, filename="face.png")
    failures.check(img.ok, f"valid png rejected: {img.errors}")
    failures.check(img.width == 512 and img.height == 512, f"dims={img.width}x{img.height}")
    failures.check(img.mime_type == "image/png", f"mime={img.mime_type}")
    failures.check(bool(img.sha256), "missing sha256")

    bad_img = validate_image_bytes(b"not-an-image", filename="x.png")
    failures.check(not bad_img.ok, "garbage image should fail")
    failures.check(len(bad_img.errors) > 0, "expected image errors")

    tiny = validate_image_bytes(_minimal_png(64, 64), filename="tiny.png")
    failures.check(not tiny.ok, "64px image should fail min side check")

    wav = _minimal_wav(duration_ms=1500)
    aud = validate_audio_bytes(wav, filename="voice.wav")
    failures.check(aud.ok, f"valid wav rejected: {aud.errors}")
    failures.check(aud.mime_type == "audio/wav", f"audio mime={aud.mime_type}")
    failures.check(
        aud.duration_ms is not None and 1400 <= aud.duration_ms <= 1600,
        f"duration_ms={aud.duration_ms}",
    )

    short = validate_audio_bytes(_minimal_wav(duration_ms=100), filename="short.wav")
    failures.check(not short.ok, "100ms audio should fail min duration")

    junk = validate_asset_bytes(b"\x00\x01\x02", filename="file.xyz")
    failures.check(not junk.ok, "unknown extension should fail")

    print("  [ok] image/audio validation accept/reject")

    # ------------------------------------------------------------------
    # 3) Captioning
    # ------------------------------------------------------------------
    cap = build_caption(
        filename="face.png",
        character_id="naughty-syntax",
        trigger_word="nskx",
    )
    failures.check("nskx" in cap.caption, f"caption missing trigger: {cap.caption}")
    failures.check(cap.filename == "face.txt", f"caption file={cap.filename}")
    failures.check(cap.source == "template", f"source={cap.source}")

    cap2 = build_caption(
        filename="face.png",
        character_id="char",
        provided_caption="smiling, studio lighting",
        trigger_word="ava",
    )
    failures.check(cap2.source == "provided", f"source={cap2.source}")
    failures.check("ava" in cap2.caption, cap2.caption)
    failures.check("smiling" in cap2.caption, cap2.caption)
    print("  [ok] caption generation")

    # ------------------------------------------------------------------
    # 4) Dataset staging
    # ------------------------------------------------------------------
    prev = _set_env(
        WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        RUNPOD_TRAINING_URL="",
        RUNPOD_TRAINING_API_KEY="",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.services.trainer.dataset import DatasetService

        with tempfile.TemporaryDirectory(prefix="trainer-ds-") as tmp:
            svc = DatasetService(get_settings(), root_dir=tmp)
            result = svc.create_dataset(
                character_id="char-smoke",
                files=[
                    ("portrait.png", _minimal_png(512, 768)),
                    ("line.wav", _minimal_wav(2000)),
                ],
                captions={"portrait.png": "front view, soft light"},
                trigger_word="csmoke",
                extra_tags=["cyberpunk"],
            )
            failures.check(result.ok, f"dataset not ok: {result.errors}")
            failures.check(result.image_count == 1, f"images={result.image_count}")
            failures.check(result.audio_count == 1, f"audio={result.audio_count}")
            failures.check(result.caption_count >= 2, f"captions={result.caption_count}")
            failures.check(
                result.storage_uri is not None
                and "procharacters-weights" in (result.storage_uri or ""),
                f"storage_uri={result.storage_uri}",
            )
            ds_path = Path(result.dataset_dir)
            failures.check(
                (ds_path / "manifest.json").is_file(), "missing manifest.json"
            )
            failures.check(
                (ds_path / "images" / "portrait.png").is_file(),
                "missing staged image",
            )
            failures.check(
                (ds_path / "images" / "portrait.txt").is_file(),
                "missing image caption sidecar",
            )
            cap_text = (ds_path / "images" / "portrait.txt").read_text(encoding="utf-8")
            failures.check("csmoke" in cap_text, f"caption text={cap_text!r}")
            failures.check("front view" in cap_text, f"caption text={cap_text!r}")

            # Invalid asset should be recorded without killing the whole batch
            bad = svc.create_dataset(
                character_id="char-smoke",
                files=[
                    ("good.png", _minimal_png(400, 400)),
                    ("bad.bin", b"nope"),
                ],
                trigger_word="x",
            )
            failures.check(bad.image_count == 1, f"bad batch images={bad.image_count}")
            failures.check(len(bad.errors) >= 1, "expected validation errors listed")
            failures.check(bad.ok, "partial success should still be ok with 1 image")

        print("  [ok] dataset staging + captions + manifest")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 5) Mock training job dispatch + status + logs
    # ------------------------------------------------------------------
    prev = _set_env(
        RUNPOD_TRAINING_URL="",  # force mock
        WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        RUNPOD_TRAINING_API_KEY="k",
    )
    try:
        _reload()
        from app.core.config import get_settings
        from app.services.trainer.runpod_job import (
            JobStatus,
            StartJobRequest,
            TrainingJobClient,
            TrainingKind,
            reset_mock_jobs,
        )

        reset_mock_jobs()
        client = TrainingJobClient(get_settings(), mock=True)
        start = await client.start_job(
            StartJobRequest(
                training_kind=TrainingKind.KOHYA_SS,
                character_id="char-smoke",
                dataset_id="ds-test",
                dataset_dir="/tmp/fake",
                trigger_word="csmoke",
            )
        )
        failures.check(start.ok, f"mock start failed: {start}")
        failures.check(bool(start.job_id), "missing job_id")
        failures.check(start.provider == "mock", f"provider={start.provider}")
        failures.check(
            start.status in (JobStatus.RUNNING, JobStatus.QUEUED),
            f"status={start.status}",
        )

        # Same process-wide store: new client can see the job
        client2 = TrainingJobClient(get_settings(), mock=True)
        st1 = await client2.get_status(start.job_id or "")
        failures.check(st1.ok, f"status1: {st1}")
        failures.check(
            st1.status in (JobStatus.RUNNING, JobStatus.COMPLETED),
            f"st1={st1.status}",
        )

        st2 = await client2.get_status(start.job_id or "")
        failures.check(st2.status == JobStatus.COMPLETED, f"st2={st2.status}")
        failures.check(st2.is_success, "expected success")
        failures.check(
            st2.weights_uri is not None
            and "procharacters-weights" in (st2.weights_uri or ""),
            f"weights_uri={st2.weights_uri}",
        )

        logs = await client2.get_logs(start.job_id or "")
        failures.check(logs.ok, f"logs: {logs}")
        failures.check("mock" in logs.logs.lower(), f"logs={logs.logs!r}")

        # Unsloth + XTTS kinds also dispatch
        for kind in (TrainingKind.UNSLOTH, TrainingKind.XTTS):
            r = await client.start_job(
                StartJobRequest(
                    training_kind=kind,
                    character_id="char-smoke",
                    dataset_id="ds-test",
                )
            )
            failures.check(r.ok, f"{kind} start failed: {r}")

        await client.aclose()
        await client2.aclose()
        print("  [ok] mock training job start/status/logs")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # 6) HTTPX MockTransport — real RunPod-shaped responses
    # ------------------------------------------------------------------
    async def _mock_handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/run") or path.endswith("/runsync"):
            return httpx.Response(
                200,
                json={"id": "job-train-42", "status": "IN_QUEUE"},
            )
        if "/status/" in path or path.endswith("/job/job-train-42"):
            return httpx.Response(
                200,
                json={
                    "id": "job-train-42",
                    "status": "COMPLETED",
                    "output": {
                        "weights_uri": "s3://procharacters-weights/weights/c/k/job-train-42",
                        "progress": 1.0,
                        "logs": "epoch 10/10 done\n",
                    },
                },
            )
        if "/logs/" in path:
            return httpx.Response(
                200,
                json={"id": "job-train-42", "logs": "line1\nline2\n"},
            )
        return httpx.Response(404, json={"error": "not found"})

    transport = httpx.MockTransport(_mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://runpod.test"
    ) as http_client:
        from app.core.config import Settings
        from app.services.trainer.runpod_job import (
            StartJobRequest,
            TrainingJobClient,
            TrainingKind,
        )

        cfg = Settings(
            RUNPOD_TRAINING_URL="https://runpod.test/v2/training",
            RUNPOD_TRAINING_API_KEY="k",
            WEIGHTS_STORAGE_BUCKET="procharacters-weights",
        )
        client = TrainingJobClient(cfg, client=http_client, mock=False)
        start = await client.start_job(
            StartJobRequest(
                training_kind=TrainingKind.KOHYA_SS,
                character_id="c",
                dataset_id="d",
            )
        )
        failures.check(start.ok, f"transport start: {start}")
        failures.check(start.job_id == "job-train-42", f"job_id={start.job_id}")

        st = await client.get_status("job-train-42")
        failures.check(st.ok, f"transport status: {st}")
        failures.check(st.is_success, f"status={st.status}")
        failures.check(
            st.weights_uri is not None and "weights" in st.weights_uri,
            f"weights={st.weights_uri}",
        )

        logs = await client.get_logs("job-train-42")
        failures.check(logs.ok and "line1" in logs.logs, f"logs={logs}")
        print("  [ok] HTTPX mock transport parses RunPod training responses")

    # ------------------------------------------------------------------
    # 7) FastAPI routes registered
    # ------------------------------------------------------------------
    from fastapi.testclient import TestClient

    from app.main import app

    def _collect_paths(routes: Any, prefix: str = "") -> set[str]:
        found: set[str] = set()
        for r in routes:
            path = getattr(r, "path", None)
            if path:
                found.add(f"{prefix}{path}" if not str(path).startswith("/") else path)
            # FastAPI may nest included routers instead of flattening paths
            nested = getattr(r, "routes", None) or getattr(
                getattr(r, "app", None), "routes", None
            )
            if nested:
                child_prefix = prefix
                if path and not getattr(r, "path_format", None):
                    child_prefix = f"{prefix}{path}"
                # Prefer router prefix attribute when present
                r_prefix = getattr(r, "prefix", None)
                if r_prefix:
                    child_prefix = f"{prefix}{r_prefix}"
                found |= _collect_paths(nested, child_prefix)
        return found

    paths = _collect_paths(app.routes)
    # Also probe OpenAPI paths (most reliable across FastAPI versions)
    try:
        openapi_paths = set((app.openapi() or {}).get("paths", {}).keys())
    except Exception:
        openapi_paths = set()
    all_paths = paths | openapi_paths
    failures.check(
        any(p.endswith("/trainer/dataset") or p == "/api/v1/trainer/dataset" for p in all_paths)
        or "/api/v1/trainer/dataset" in all_paths,
        f"dataset route missing; have={sorted(p for p in all_paths if p and 'trainer' in p)}",
    )
    failures.check(
        any("start-job" in (p or "") for p in all_paths),
        "start-job route missing",
    )
    failures.check(
        any("status" in (p or "") and "trainer" in (p or "") for p in all_paths),
        "status route missing",
    )

    prev = _set_env(
        RUNPOD_TRAINING_URL="",
        WEIGHTS_STORAGE_BUCKET="smoke-bucket",
        RUNPOD_TRAINING_API_KEY="",
    )
    try:
        _reload()
        from app.services.trainer.runpod_job import reset_mock_jobs

        reset_mock_jobs()
        with TestClient(app) as tc:
            # discovery
            r = tc.get("/api/v1/trainer")
            failures.check(r.status_code == 200, f"trainer root={r.status_code}")
            body = r.json()
            failures.check(body.get("service") == "trainer", body)

            # dataset via POST /api/v1/trainer/dataset (JSON + base64 assets)
            import base64

            png_b64 = base64.b64encode(_minimal_png(512, 512)).decode("ascii")
            r = tc.post(
                "/api/v1/trainer/dataset",
                json={
                    "character_id": "api-char",
                    "trigger_word": "apichar",
                    "assets": [
                        {"filename": "a.png", "content_b64": png_b64},
                    ],
                    "captions": {"a.png": "portrait, clean background"},
                },
            )
            failures.check(
                r.status_code == 200,
                f"dataset status={r.status_code} {r.text}",
            )
            ds = r.json()
            failures.check(ds.get("ok") is True, f"dataset body={ds}")
            failures.check(ds.get("image_count") == 1, ds)
            dataset_id = ds.get("dataset_id")
            failures.check(bool(dataset_id), "no dataset_id")

            # start job (auto-mock: no RUNPOD_TRAINING_URL)
            r = tc.post(
                "/api/v1/trainer/start-job",
                json={
                    "training_kind": "kohya_ss",
                    "character_id": "api-char",
                    "dataset_id": dataset_id,
                    "trigger_word": "apichar",
                    "mock": True,
                },
            )
            failures.check(r.status_code == 200, f"start-job={r.status_code} {r.text}")
            job = r.json()
            failures.check(job.get("ok") is True, job)
            job_id = job.get("job_id")
            failures.check(bool(job_id), "no job_id from start-job")

            r = tc.get(f"/api/v1/trainer/status/{job_id}", params={"mock": True})
            failures.check(r.status_code == 200, f"status={r.status_code} {r.text}")
            st = r.json()
            failures.check(st.get("job_id") == job_id, st)

            # health includes training flags
            r = tc.get("/health")
            failures.check(r.status_code == 200, f"health={r.status_code}")
            h = r.json()
            failures.check("training_configured" in h, h)

        print("  [ok] FastAPI trainer routes + end-to-end mock pipeline")
    finally:
        _restore_env(prev)
        _reload()

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------
    if not failures.ok():
        print("SMOKE TRAINER FAILED")
        for item in failures.items:
            print(f"  - {item}")
        return 1

    print("SMOKE TRAINER OK")
    print("  dataset validation + captioning")
    print("  mock + HTTPX training job dispatch")
    print("  RUNPOD_TRAINING_* / WEIGHTS_STORAGE_BUCKET settings")
    print("  /api/v1/trainer/* routes")
    return 0


def main() -> int:
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
