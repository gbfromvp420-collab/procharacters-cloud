#!/usr/bin/env python3
"""
Unified test runner for the WebRTC + trainer studio stack.

Sequentially executes:
  1. scripts/smoke_full_pipeline.py
  2. scripts/smoke_trainer_pipeline.py
  3. scripts/smoke_runpod_provider.py
  4. scripts/smoke_static_webrtc.py
  5. scripts/stress_webrtc_sessions.py  (starts a local Uvicorn if needed)

Exit code:
  0 — all suites passed
  1 — one or more suites failed
  2 — runner misconfiguration / could not start dependencies

Usage:
  python3 scripts/run_all_tests.py
  python3 scripts/run_all_tests.py --skip-stress
  python3 scripts/run_all_tests.py --stress-sessions 10
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

# Suite order is intentional: pure unit/smoke first, then live HTTP stress.
SMOKE_SUITES: list[tuple[str, str]] = [
    ("smoke_full_pipeline", "scripts/smoke_full_pipeline.py"),
    ("smoke_trainer_pipeline", "scripts/smoke_trainer_pipeline.py"),
    ("smoke_runpod_provider", "scripts/smoke_runpod_provider.py"),
    ("smoke_static_webrtc", "scripts/smoke_static_webrtc.py"),
]

DEFAULT_BASE_URL = os.environ.get("STRESS_BASE_URL", "http://127.0.0.1:8000")
DEFAULT_STRESS_SESSIONS = int(os.environ.get("STRESS_SESSIONS", "20"))
DEFAULT_STRESS_CONCURRENCY = int(os.environ.get("STRESS_CONCURRENCY", "20"))


@dataclass
class SuiteResult:
    name: str
    command: list[str]
    exit_code: int
    duration_s: float
    skipped: bool = False
    note: str = ""

    @property
    def ok(self) -> bool:
        return self.skipped or self.exit_code == 0


@dataclass
class RunnerReport:
    results: list[SuiteResult] = field(default_factory=list)

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.ok and not r.skipped)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.ok)

    @property
    def skipped(self) -> int:
        return sum(1 for r in self.results if r.skipped)

    @property
    def all_ok(self) -> bool:
        return self.failed == 0


def _banner(title: str) -> None:
    line = "=" * 64
    print(f"\n{line}\n{title}\n{line}", flush=True)


def _health_ok(base_url: str, timeout: float = 2.0) -> bool:
    url = base_url.rstrip("/") + "/health"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _run_suite(
    name: str,
    script_rel: str,
    *,
    extra_args: list[str] | None = None,
    env: dict[str, str] | None = None,
) -> SuiteResult:
    script_path = ROOT / script_rel
    if not script_path.is_file():
        return SuiteResult(
            name=name,
            command=[],
            exit_code=2,
            duration_s=0.0,
            note=f"missing script: {script_rel}",
        )

    cmd = [sys.executable, str(script_path)]
    if extra_args:
        cmd.extend(extra_args)

    print(f"\n>>> RUN  {name}")
    print(f"    cmd: {' '.join(cmd)}", flush=True)

    run_env = os.environ.copy()
    # Ensure project root imports resolve for app.*
    run_env["PYTHONPATH"] = (
        str(ROOT) + os.pathsep + run_env.get("PYTHONPATH", "")
    ).rstrip(os.pathsep)
    if env:
        run_env.update(env)

    t0 = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(ROOT),
            env=run_env,
            check=False,
        )
        code = int(proc.returncode)
    except OSError as exc:
        print(f"    ERROR launching suite: {exc}", flush=True)
        code = 2
    duration = time.perf_counter() - t0

    status = "PASS" if code == 0 else "FAIL"
    print(f"<<< {status} {name}  exit={code}  {duration:.2f}s", flush=True)
    return SuiteResult(
        name=name,
        command=cmd,
        exit_code=code,
        duration_s=duration,
    )


def _start_uvicorn(base_url: str, port: int) -> subprocess.Popen[Any] | None:
    """Start uvicorn for stress tests; return Popen if we started it."""
    if _health_ok(base_url):
        print(f"    uvicorn already healthy at {base_url}", flush=True)
        return None

    print(f"    starting uvicorn on port {port} …", flush=True)
    env = os.environ.copy()
    env["PYTHONPATH"] = (
        str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    ).rstrip(os.pathsep)
    # Deterministic mock providers for CI / local suite runs
    env.setdefault("VIDEO_PROVIDER", "mock")
    env.setdefault("LLM_PROVIDER", "mock")
    env.setdefault("RUNPOD_FALLBACK_TO_MOCK", "true")

    log_path = ROOT / ".uvicorn-test.log"
    log_f = open(log_path, "w", encoding="utf-8")  # noqa: SIM115 — kept for child lifetime
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=str(ROOT),
        env=env,
        stdout=log_f,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

    deadline = time.time() + 30.0
    while time.time() < deadline:
        if proc.poll() is not None:
            log_f.flush()
            print(
                f"    uvicorn exited early code={proc.returncode}; "
                f"see {log_path}",
                flush=True,
            )
            try:
                log_f.close()
            except OSError:
                pass
            return None
        if _health_ok(base_url, timeout=1.0):
            print(f"    uvicorn ready (pid={proc.pid})", flush=True)
            # Keep log file open for the process; close our handle
            try:
                log_f.close()
            except OSError:
                pass
            return proc
        time.sleep(0.25)

    print("    uvicorn failed to become healthy within 30s", flush=True)
    _stop_uvicorn(proc)
    try:
        log_f.close()
    except OSError:
        pass
    return None


def _stop_uvicorn(proc: subprocess.Popen[Any] | None) -> None:
    if proc is None:
        return
    if proc.poll() is not None:
        return
    print(f"    stopping uvicorn pid={proc.pid}", flush=True)
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            proc.terminate()
        except OSError:
            pass
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                proc.kill()
            except OSError:
                pass
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass


def print_summary(report: RunnerReport) -> None:
    _banner("TEST SUMMARY")
    total = len(report.results)
    print(f"suites: {total}  passed: {report.passed}  failed: {report.failed}  skipped: {report.skipped}")
    print()
    print(f"{'SUITE':<28} {'STATUS':<8} {'EXIT':>5} {'TIME':>8}  NOTES")
    print("-" * 72)
    for r in report.results:
        if r.skipped:
            status = "SKIP"
        elif r.ok:
            status = "PASS"
        else:
            status = "FAIL"
        note = r.note or ""
        print(
            f"{r.name:<28} {status:<8} {r.exit_code:>5} {r.duration_s:>7.2f}s  {note}"
        )
    print("-" * 72)
    if report.all_ok:
        print("ALL SUITES PASSED")
    else:
        print("ONE OR MORE SUITES FAILED")
        failed_names = [r.name for r in report.results if not r.ok]
        print("failed: " + ", ".join(failed_names))


def run_all(args: argparse.Namespace) -> int:
    os.chdir(ROOT)
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    report = RunnerReport()
    _banner("WebRTC + Trainer — unified test runner")
    print(f"root: {ROOT}")
    print(f"python: {sys.executable} ({sys.version.split()[0]})")

    # ------------------------------------------------------------------
    # Smoke suites
    # ------------------------------------------------------------------
    for name, rel in SMOKE_SUITES:
        if args.only and name not in args.only and not any(
            name.startswith(o) or o in name for o in args.only
        ):
            report.results.append(
                SuiteResult(
                    name=name,
                    command=[],
                    exit_code=0,
                    duration_s=0.0,
                    skipped=True,
                    note="filtered by --only",
                )
            )
            continue
        report.results.append(_run_suite(name, rel))
        if args.fail_fast and not report.results[-1].ok:
            print("\n--fail-fast: stopping after first failure", flush=True)
            print_summary(report)
            return 1

    # ------------------------------------------------------------------
    # Stress suite (live HTTP)
    # ------------------------------------------------------------------
    stress_name = "stress_webrtc_sessions"
    if args.skip_stress:
        report.results.append(
            SuiteResult(
                name=stress_name,
                command=[],
                exit_code=0,
                duration_s=0.0,
                skipped=True,
                note="--skip-stress",
            )
        )
    elif args.only and stress_name not in args.only and not any(
        "stress" in o for o in args.only
    ):
        report.results.append(
            SuiteResult(
                name=stress_name,
                command=[],
                exit_code=0,
                duration_s=0.0,
                skipped=True,
                note="filtered by --only",
            )
        )
    else:
        base_url = args.base_url.rstrip("/")
        # Parse port from base_url for local server start
        port = 8000
        try:
            from urllib.parse import urlparse

            parsed = urlparse(base_url)
            if parsed.port:
                port = parsed.port
        except Exception:  # noqa: BLE001
            port = 8000

        owned_proc: subprocess.Popen[Any] | None = None
        if args.start_server:
            owned_proc = _start_uvicorn(base_url, port)
            if owned_proc is None and not _health_ok(base_url):
                report.results.append(
                    SuiteResult(
                        name=stress_name,
                        command=[],
                        exit_code=2,
                        duration_s=0.0,
                        note="could not start or reach uvicorn for stress tests",
                    )
                )
                print_summary(report)
                return 1 if report.failed else 2
        elif not _health_ok(base_url):
            # Auto-start when nothing is listening (CI / fresh shells)
            print(
                f"    no server at {base_url}; auto-starting uvicorn",
                flush=True,
            )
            owned_proc = _start_uvicorn(base_url, port)
            if owned_proc is None and not _health_ok(base_url):
                report.results.append(
                    SuiteResult(
                        name=stress_name,
                        command=[],
                        exit_code=2,
                        duration_s=0.0,
                        note="stress requires a live server; start failed",
                    )
                )
                print_summary(report)
                return 1

        try:
            stress_args = [
                "--base-url",
                base_url,
                "--sessions",
                str(args.stress_sessions),
                "--concurrency",
                str(args.stress_concurrency),
            ]
            if args.verbose:
                stress_args.append("--verbose")
            report.results.append(
                _run_suite(
                    stress_name,
                    "scripts/stress_webrtc_sessions.py",
                    extra_args=stress_args,
                )
            )
        finally:
            if owned_proc is not None:
                _stop_uvicorn(owned_proc)

    print_summary(report)
    return 0 if report.all_ok else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Run all smoke suites + WebRTC stress test.",
    )
    p.add_argument(
        "--skip-stress",
        action="store_true",
        help="Run smoke suites only (no live HTTP stress)",
    )
    p.add_argument(
        "--start-server",
        action="store_true",
        help="Always try to start a local Uvicorn before stress (default: auto)",
    )
    p.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL for stress tests (default: {DEFAULT_BASE_URL})",
    )
    p.add_argument(
        "--stress-sessions",
        type=int,
        default=DEFAULT_STRESS_SESSIONS,
        help=f"Stress session count (default: {DEFAULT_STRESS_SESSIONS})",
    )
    p.add_argument(
        "--stress-concurrency",
        type=int,
        default=DEFAULT_STRESS_CONCURRENCY,
        help=f"Stress concurrency (default: {DEFAULT_STRESS_CONCURRENCY})",
    )
    p.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop after the first failing suite",
    )
    p.add_argument(
        "--only",
        nargs="*",
        default=None,
        help="Optional suite name filters (substring match)",
    )
    p.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Pass --verbose through to stress suite",
    )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return run_all(args)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
