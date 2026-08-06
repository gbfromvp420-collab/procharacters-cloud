#!/usr/bin/env python3
"""
Concurrency stress test for WebRTC signaling + chat pipeline.

Simulates N parallel clients. Each session:
  1. POST /api/v1/webrtc/session     (create + bind character / LoRA)
  2. GET  /api/v1/trainer/weights/resolve  (weight resolution)
  3. POST /api/v1/webrtc/offer       (SDP offer → answer)
  4. POST /api/v1/chat/perform       (chat execution)
  5. POST /api/v1/webrtc/hangup      (teardown)

Reports latency p50/p95/p99, error rates, peak RSS (client + optional server),
and verifies session cleanup after hangup.

Usage:
  python3 scripts/stress_webrtc_sessions.py
  python3 scripts/stress_webrtc_sessions.py --sessions 20 --base-url http://127.0.0.1:8000
  python3 scripts/stress_webrtc_sessions.py --sessions 50 --concurrency 20
"""

from __future__ import annotations

import argparse
import asyncio
import math
import os
import resource
import statistics
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

try:
    import httpx
except ImportError:  # pragma: no cover
    print("httpx is required: pip install httpx", file=sys.stderr)
    raise SystemExit(2) from None

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MINIMAL_OFFER_SDP = (
    "v=0\r\n"
    "o=- 0 0 IN IP4 127.0.0.1\r\n"
    "s=StressOffer\r\n"
    "t=0 0\r\n"
    "a=group:BUNDLE 0 1\r\n"
    "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
    "c=IN IP4 0.0.0.0\r\n"
    "a=mid:0\r\n"
    "a=sendrecv\r\n"
    "a=rtpmap:111 opus/48000/2\r\n"
    "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n"
    "c=IN IP4 0.0.0.0\r\n"
    "a=mid:1\r\n"
    "a=sendrecv\r\n"
    "a=rtpmap:96 VP8/90000\r\n"
)

PHASES = ("session", "weights", "offer", "chat", "hangup", "total")


# ---------------------------------------------------------------------------
# Metrics helpers
# ---------------------------------------------------------------------------


def percentile(sorted_vals: list[float], p: float) -> float:
    """Nearest-rank percentile on a pre-sorted list (p in 0..100)."""
    if not sorted_vals:
        return float("nan")
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)


def summarize(latencies_ms: list[float]) -> dict[str, float]:
    if not latencies_ms:
        return {
            "count": 0,
            "p50_ms": float("nan"),
            "p95_ms": float("nan"),
            "p99_ms": float("nan"),
            "mean_ms": float("nan"),
            "max_ms": float("nan"),
            "min_ms": float("nan"),
        }
    s = sorted(latencies_ms)
    return {
        "count": len(s),
        "p50_ms": round(percentile(s, 50), 3),
        "p95_ms": round(percentile(s, 95), 3),
        "p99_ms": round(percentile(s, 99), 3),
        "mean_ms": round(statistics.fmean(s), 3),
        "max_ms": round(s[-1], 3),
        "min_ms": round(s[0], 3),
    }


def rss_mb() -> float:
    """Current process RSS in MiB (Linux: ru_maxrss is KiB)."""
    usage = resource.getrusage(resource.RUSAGE_SELF)
    # Linux: KiB; macOS: bytes — detect via size magnitude
    rss = usage.ru_maxrss
    if rss > 10**9:  # likely bytes (macOS)
        return rss / (1024 * 1024)
    return rss / 1024.0


def read_proc_rss_mb(pid: int) -> float | None:
    """Read RSS of another process from /proc (Linux)."""
    try:
        with open(f"/proc/{pid}/status", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    # VmRSS:   12345 kB
                    parts = line.split()
                    return int(parts[1]) / 1024.0
    except (OSError, ValueError, IndexError):
        return None
    return None


def find_uvicorn_pid(port: int = 8000) -> int | None:
    """Best-effort find of the uvicorn server PID listening on port."""
    # Prefer /proc scan for cmdline
    try:
        for name in os.listdir("/proc"):
            if not name.isdigit():
                continue
            pid = int(name)
            try:
                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    cmd = f.read().replace(b"\x00", b" ").decode("utf-8", "ignore")
            except OSError:
                continue
            if "uvicorn" in cmd and "app.main" in cmd:
                return pid
    except OSError:
        pass
    return None


# ---------------------------------------------------------------------------
# Session worker
# ---------------------------------------------------------------------------


@dataclass
class PhaseResult:
    name: str
    ok: bool
    latency_ms: float
    error: str | None = None
    detail: dict[str, Any] = field(default_factory=dict)


@dataclass
class SessionResult:
    session_id: str
    index: int
    ok: bool
    phases: list[PhaseResult] = field(default_factory=list)
    total_ms: float = 0.0
    error: str | None = None

    def phase_map(self) -> dict[str, PhaseResult]:
        return {p.name: p for p in self.phases}


async def _timed(
    name: str,
    coro_factory,
) -> PhaseResult:
    t0 = time.perf_counter()
    try:
        detail = await coro_factory()
        ms = (time.perf_counter() - t0) * 1000.0
        return PhaseResult(name=name, ok=True, latency_ms=ms, detail=detail or {})
    except Exception as exc:  # noqa: BLE001 — stress boundary
        ms = (time.perf_counter() - t0) * 1000.0
        return PhaseResult(
            name=name,
            ok=False,
            latency_ms=ms,
            error=str(exc)[:400],
        )


async def run_one_session(
    client: httpx.AsyncClient,
    *,
    index: int,
    character_id: str,
    lora_id: str | None,
    hangup: bool,
) -> SessionResult:
    session_id = f"stress-{index:04d}-{uuid.uuid4().hex[:10]}"
    result = SessionResult(session_id=session_id, index=index, ok=True)
    t_total = time.perf_counter()

    async def do_session() -> dict[str, Any]:
        r = await client.post(
            "/api/v1/webrtc/session",
            json={
                "session_id": session_id,
                "character_id": character_id,
                "lora_id": lora_id,
            },
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("ok", True):
            raise RuntimeError(f"session not ok: {body}")
        ice = body.get("iceServers") or []
        if not isinstance(ice, list) or not ice:
            raise RuntimeError("session missing iceServers")
        return {
            "character_id": body.get("character_id"),
            "ice_count": len(ice),
            "has_weights": isinstance(body.get("weights"), dict),
        }

    async def do_weights() -> dict[str, Any]:
        params: dict[str, str] = {"character_id": character_id}
        if lora_id:
            params["lora_id"] = lora_id
        r = await client.get("/api/v1/trainer/weights/resolve", params=params)
        r.raise_for_status()
        body = r.json()
        if body.get("ok") is False:
            raise RuntimeError(f"weights resolve failed: {body}")
        return {
            "character_id": body.get("character_id") or character_id,
            "lora_id": body.get("lora_id"),
            "has_inference": isinstance(body.get("inference"), dict)
            or "inference" in body
            or "visual_lora" in body,
        }

    async def do_offer() -> dict[str, Any]:
        r = await client.post(
            "/api/v1/webrtc/offer",
            json={
                "session_id": session_id,
                "sdp": MINIMAL_OFFER_SDP,
                "type": "offer",
                "character_id": character_id,
                "lora_id": lora_id,
            },
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("sdp"):
            raise RuntimeError(f"offer missing sdp: {body}")
        if body.get("type") not in (None, "answer"):
            # server returns type=answer
            pass
        return {
            "type": body.get("type"),
            "sdp_len": len(body.get("sdp") or ""),
            "character_id": body.get("character_id"),
        }

    async def do_chat() -> dict[str, Any]:
        r = await client.post(
            "/api/v1/chat/perform",
            json={
                "session_id": session_id,
                "character_id": character_id,
                "lora_id": lora_id,
                "message": f"stress hello from session {index}",
            },
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("ok"):
            raise RuntimeError(f"chat not ok: {body}")
        if not body.get("reply"):
            raise RuntimeError(f"chat empty reply: {body}")
        return {
            "reply_len": len(body.get("reply") or ""),
            "provider_llm": body.get("provider_llm"),
            "provider_video": body.get("provider_video"),
        }

    async def do_hangup() -> dict[str, Any]:
        r = await client.post(
            "/api/v1/webrtc/hangup",
            json={"session_id": session_id},
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("ok"):
            raise RuntimeError(f"hangup not ok: {body}")
        return {"existed": body.get("existed")}

    phases_spec = [
        ("session", do_session),
        ("weights", do_weights),
        ("offer", do_offer),
        ("chat", do_chat),
    ]
    if hangup:
        phases_spec.append(("hangup", do_hangup))

    for name, factory in phases_spec:
        pr = await _timed(name, factory)
        result.phases.append(pr)
        if not pr.ok:
            result.ok = False
            result.error = f"{name}: {pr.error}"
            # Still attempt hangup for cleanup if later phases skipped
            if hangup and name != "hangup":
                try:
                    hr = await _timed("hangup", do_hangup)
                    result.phases.append(hr)
                except Exception:  # noqa: BLE001
                    pass
            break

    result.total_ms = (time.perf_counter() - t_total) * 1000.0
    return result


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


async def run_stress(args: argparse.Namespace) -> int:
    base_url = args.base_url.rstrip("/")
    n = args.sessions
    concurrency = min(args.concurrency, n)

    # Pre-flight
    async with httpx.AsyncClient(base_url=base_url, timeout=args.timeout) as probe:
        try:
            health = await probe.get("/health")
            health.raise_for_status()
            health_body = health.json()
        except Exception as exc:  # noqa: BLE001
            print(f"STRESS FAILED: cannot reach {base_url}/health: {exc}")
            return 2

    print(f"Stress target: {base_url}")
    print(f"  health: {health_body}")
    print(f"  sessions={n} concurrency={concurrency} character={args.character_id!r}")
    print()

    server_pid = find_uvicorn_pid()
    rss_samples_client: list[float] = []
    rss_samples_server: list[float] = []
    if server_pid:
        before_server = read_proc_rss_mb(server_pid)
        print(f"  server_pid={server_pid} rss_before={before_server:.1f} MiB")
    else:
        before_server = None
        print("  server_pid=unknown (RSS peak will be client-only)")

    sem = asyncio.Semaphore(concurrency)
    results: list[SessionResult] = []
    results_lock = asyncio.Lock()

    timeout = httpx.Timeout(args.timeout, connect=min(10.0, args.timeout))
    limits = httpx.Limits(
        max_connections=max(concurrency * 2, 20),
        max_keepalive_connections=concurrency,
    )

    async def worker(index: int, client: httpx.AsyncClient) -> None:
        async with sem:
            rss_samples_client.append(rss_mb())
            if server_pid:
                s = read_proc_rss_mb(server_pid)
                if s is not None:
                    rss_samples_server.append(s)
            res = await run_one_session(
                client,
                index=index,
                character_id=args.character_id,
                lora_id=args.lora_id or None,
                hangup=not args.no_hangup,
            )
            async with results_lock:
                results.append(res)
            rss_samples_client.append(rss_mb())
            if server_pid:
                s = read_proc_rss_mb(server_pid)
                if s is not None:
                    rss_samples_server.append(s)

    t0 = time.perf_counter()
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=timeout,
        limits=limits,
        headers={"User-Agent": "stress-webrtc-sessions/1.0"},
    ) as client:
        tasks = [asyncio.create_task(worker(i, client)) for i in range(n)]
        await asyncio.gather(*tasks)
    wall_s = time.perf_counter() - t0

    # ------------------------------------------------------------------
    # Aggregate
    # ------------------------------------------------------------------
    ok_count = sum(1 for r in results if r.ok)
    fail_count = n - ok_count
    error_rate = fail_count / n if n else 0.0

    by_phase: dict[str, list[float]] = {p: [] for p in PHASES}
    phase_errors: dict[str, int] = {p: 0 for p in PHASES}
    for r in results:
        by_phase["total"].append(r.total_ms)
        for pr in r.phases:
            by_phase.setdefault(pr.name, []).append(pr.latency_ms)
            if not pr.ok:
                phase_errors[pr.name] = phase_errors.get(pr.name, 0) + 1

    peak_client = max(rss_samples_client) if rss_samples_client else rss_mb()
    peak_server = max(rss_samples_server) if rss_samples_server else None
    after_server = read_proc_rss_mb(server_pid) if server_pid else None

    # ------------------------------------------------------------------
    # Cleanup verification — hung-up sessions must 404
    # ------------------------------------------------------------------
    cleanup_checked = 0
    cleanup_leaked = 0
    cleanup_errors: list[str] = []
    if not args.no_hangup:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
            # Sample up to 50 sessions for cleanup check
            sample = results[: min(50, len(results))]
            for r in sample:
                cleanup_checked += 1
                try:
                    resp = await client.get(f"/api/v1/webrtc/session/{r.session_id}")
                    if resp.status_code == 404:
                        continue
                    if resp.status_code == 200:
                        cleanup_leaked += 1
                        cleanup_errors.append(
                            f"{r.session_id} still present after hangup"
                        )
                    else:
                        cleanup_errors.append(
                            f"{r.session_id} unexpected status {resp.status_code}"
                        )
                except Exception as exc:  # noqa: BLE001
                    cleanup_errors.append(f"{r.session_id} check error: {exc}")

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------
    print("=" * 64)
    print("STRESS REPORT — WebRTC signaling + chat")
    print("=" * 64)
    print(f"wall_time_s     : {wall_s:.3f}")
    print(f"sessions        : {n}")
    print(f"concurrency     : {concurrency}")
    print(f"ok / fail       : {ok_count} / {fail_count}")
    print(f"error_rate      : {error_rate * 100:.2f}%")
    print(f"throughput      : {n / wall_s:.1f} sessions/s")
    print()
    print("Latency by phase (ms):")
    print(f"  {'phase':<10} {'n':>5} {'p50':>10} {'p95':>10} {'p99':>10} {'mean':>10} {'max':>10} {'err':>5}")
    for phase in ("session", "weights", "offer", "chat", "hangup", "total"):
        stats = summarize(by_phase.get(phase) or [])
        if stats["count"] == 0:
            continue
        err_n = phase_errors.get(phase, 0)
        print(
            f"  {phase:<10} {int(stats['count']):>5} "
            f"{stats['p50_ms']:>10.2f} {stats['p95_ms']:>10.2f} {stats['p99_ms']:>10.2f} "
            f"{stats['mean_ms']:>10.2f} {stats['max_ms']:>10.2f} {err_n:>5}"
        )

    print()
    print("Memory:")
    print(f"  client_peak_rss_mib : {peak_client:.1f}")
    if before_server is not None:
        print(f"  server_rss_before   : {before_server:.1f} MiB")
    if peak_server is not None:
        print(f"  server_peak_rss_mib : {peak_server:.1f}")
    if after_server is not None:
        print(f"  server_rss_after    : {after_server:.1f} MiB")
        if before_server is not None:
            delta = after_server - before_server
            print(f"  server_rss_delta    : {delta:+.1f} MiB")

    print()
    print("Cleanup:")
    if args.no_hangup:
        print("  skipped (--no-hangup)")
        cleanup_ok = True
    else:
        print(f"  checked             : {cleanup_checked}")
        print(f"  leaked (still 200)  : {cleanup_leaked}")
        cleanup_ok = cleanup_leaked == 0
        if cleanup_errors and cleanup_leaked:
            for msg in cleanup_errors[:10]:
                print(f"  - {msg}")
        print(f"  clean_teardown      : {'YES' if cleanup_ok else 'NO'}")

    if fail_count and args.verbose:
        print()
        print("Sample failures:")
        for r in results:
            if not r.ok:
                print(f"  [{r.index}] {r.session_id}: {r.error}")
                if sum(1 for x in results if not x.ok) > 10:
                    break

    # Fail criteria
    max_error_rate = args.max_error_rate
    exit_code = 0
    if error_rate > max_error_rate:
        print(f"\nFAIL: error_rate {error_rate:.2%} > max {max_error_rate:.2%}")
        exit_code = 1
    if not cleanup_ok:
        print("\nFAIL: session teardown leaked entries")
        exit_code = 1
    if exit_code == 0:
        print("\nSTRESS OK")
    else:
        print("\nSTRESS FAILED")
    return exit_code


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--base-url",
        default=os.environ.get("STRESS_BASE_URL", "http://127.0.0.1:8000"),
        help="Target server base URL (default: http://127.0.0.1:8000)",
    )
    p.add_argument(
        "--sessions",
        "-n",
        type=int,
        default=int(os.environ.get("STRESS_SESSIONS", "20")),
        help="Number of parallel sessions to simulate (default: 20)",
    )
    p.add_argument(
        "--concurrency",
        "-c",
        type=int,
        default=int(os.environ.get("STRESS_CONCURRENCY", "20")),
        help="Max in-flight sessions (default: 20)",
    )
    p.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Per-request timeout seconds (default: 30)",
    )
    p.add_argument(
        "--character-id",
        default="stress-char",
        help="character_id bound on each session",
    )
    p.add_argument(
        "--lora-id",
        default="",
        help="Optional lora_id override",
    )
    p.add_argument(
        "--no-hangup",
        action="store_true",
        help="Skip hangup phase and cleanup verification",
    )
    p.add_argument(
        "--max-error-rate",
        type=float,
        default=0.0,
        help="Allowed error rate (0.0 = any failure fails the run)",
    )
    p.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print sample failures",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.sessions < 1:
        print("--sessions must be >= 1", file=sys.stderr)
        return 2
    if args.concurrency < 1:
        print("--concurrency must be >= 1", file=sys.stderr)
        return 2
    return asyncio.run(run_stress(args))


if __name__ == "__main__":
    raise SystemExit(main())
