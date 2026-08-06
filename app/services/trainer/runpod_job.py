"""
RunPod remote training job client (async HTTPX).

Supports dispatching Kohya_ss (avatar LoRA), Unsloth (LLM), and XTTS (voice)
jobs, polling status, and fetching worker logs.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Terminal RunPod-ish statuses
_TERMINAL = frozenset(
    {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT", "ERROR", "SUCCESS", "DONE"}
)
_SUCCESS = frozenset({"COMPLETED", "SUCCESS", "DONE"})

# Process-wide mock job store so status/logs work across request-scoped clients
_MOCK_JOBS: dict[str, dict[str, Any]] = {}


def reset_mock_jobs() -> None:
    """Clear in-memory mock jobs (tests / smoke)."""
    _MOCK_JOBS.clear()


class TrainingKind(str, Enum):
    KOHYA_SS = "kohya_ss"  # avatar / SD LoRA
    UNSLOTH = "unsloth"  # LLM fine-tune
    XTTS = "xtts"  # voice clone / retune


class JobStatus(str, Enum):
    QUEUED = "IN_QUEUE"
    RUNNING = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_raw(cls, value: str | None) -> JobStatus:
        if not value:
            return cls.UNKNOWN
        v = str(value).strip().upper()
        # Normalize common aliases
        aliases = {
            "QUEUED": cls.QUEUED,
            "IN_QUEUE": cls.QUEUED,
            "PENDING": cls.QUEUED,
            "RUNNING": cls.RUNNING,
            "IN_PROGRESS": cls.RUNNING,
            "PROCESSING": cls.RUNNING,
            "COMPLETED": cls.COMPLETED,
            "SUCCESS": cls.COMPLETED,
            "DONE": cls.COMPLETED,
            "FAILED": cls.FAILED,
            "ERROR": cls.FAILED,
            "TIMED_OUT": cls.FAILED,
            "CANCELLED": cls.CANCELLED,
            "CANCELED": cls.CANCELLED,
        }
        return aliases.get(v, cls.UNKNOWN)


@dataclass
class StartJobRequest:
    training_kind: TrainingKind
    character_id: str
    dataset_id: str
    dataset_dir: str | None = None
    dataset_uri: str | None = None
    trigger_word: str | None = None
    base_model: str | None = None
    output_name: str | None = None
    hyperparameters: dict[str, Any] = field(default_factory=dict)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_input_payload(self, *, weights_bucket: str | None = None) -> dict[str, Any]:
        output_name = self.output_name or f"{self.character_id}-{self.training_kind.value}"
        payload: dict[str, Any] = {
            "training_kind": self.training_kind.value,
            "character_id": self.character_id,
            "dataset_id": self.dataset_id,
            "dataset_dir": self.dataset_dir,
            "dataset_uri": self.dataset_uri,
            "trigger_word": self.trigger_word,
            "base_model": self.base_model or _default_base_model(self.training_kind),
            "output_name": output_name,
            "weights_storage_bucket": weights_bucket or None,
            "hyperparameters": {
                **_default_hyperparameters(self.training_kind),
                **(self.hyperparameters or {}),
            },
            **(self.extra or {}),
        }
        return payload


@dataclass
class StartJobResult:
    ok: bool
    job_id: str | None = None
    status: JobStatus = JobStatus.UNKNOWN
    training_kind: TrainingKind | None = None
    provider: str = "runpod"
    meta: dict[str, Any] = field(default_factory=dict)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "job_id": self.job_id,
            "status": self.status.value,
            "training_kind": self.training_kind.value if self.training_kind else None,
            "provider": self.provider,
            "meta": dict(self.meta),
            "error": self.error,
        }


@dataclass
class JobStatusResult:
    ok: bool
    job_id: str
    status: JobStatus
    progress: float | None = None  # 0.0 – 1.0 when known
    weights_uri: str | None = None
    logs_tail: str | None = None
    output: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    provider: str = "runpod"

    @property
    def is_terminal(self) -> bool:
        return self.status.value in {
            JobStatus.COMPLETED.value,
            JobStatus.FAILED.value,
            JobStatus.CANCELLED.value,
        } or self.status.value in _TERMINAL

    @property
    def is_success(self) -> bool:
        return self.status in (JobStatus.COMPLETED,) or (
            str(self.raw.get("status", "")).upper() in _SUCCESS
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "job_id": self.job_id,
            "status": self.status.value,
            "progress": self.progress,
            "weights_uri": self.weights_uri,
            "logs_tail": self.logs_tail,
            "output": dict(self.output),
            "error": self.error,
            "provider": self.provider,
            "is_terminal": self.is_terminal,
            "is_success": self.is_success,
        }


@dataclass
class JobLogsResult:
    ok: bool
    job_id: str
    logs: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "job_id": self.job_id,
            "logs": self.logs,
            "error": self.error,
        }


def _default_base_model(kind: TrainingKind) -> str:
    return {
        TrainingKind.KOHYA_SS: "runwayml/stable-diffusion-v1-5",
        TrainingKind.UNSLOTH: "unsloth/llama-3-8b-bnb-4bit",
        TrainingKind.XTTS: "coqui/XTTS-v2",
    }.get(kind, "default")


def _default_hyperparameters(kind: TrainingKind) -> dict[str, Any]:
    if kind == TrainingKind.KOHYA_SS:
        return {
            "network_dim": 16,
            "network_alpha": 8,
            "learning_rate": 1e-4,
            "max_train_epochs": 10,
            "train_batch_size": 1,
            "resolution": 512,
            "optimizer": "AdamW8bit",
        }
    if kind == TrainingKind.UNSLOTH:
        return {
            "learning_rate": 2e-4,
            "max_steps": 200,
            "lora_r": 16,
            "lora_alpha": 16,
            "batch_size": 2,
            "max_seq_length": 2048,
        }
    if kind == TrainingKind.XTTS:
        return {
            "epochs": 10,
            "batch_size": 2,
            "learning_rate": 5e-6,
            "language": "en",
        }
    return {}


class TrainingJobClient:
    """
    Async client for RunPod training endpoints.

    Expected shapes (serverless-compatible):
      POST {base}/run          → { id, status }
      POST {base}/runsync      → { id, status, output }
      GET  {base}/status/{id}  → { id, status, output }
      GET  {base}/logs/{id}    → { id, logs } | plain text
    """

    name = "runpod"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.AsyncClient | None = None,
        mock: bool = False,
    ) -> None:
        self.settings = settings or get_settings()
        self._owns_client = client is None
        self.mock = mock
        timeout = httpx.Timeout(
            self.settings.runpod_timeout_seconds,
            connect=self.settings.runpod_connect_timeout_seconds,
        )
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            headers=self.settings.runpod_training_headers(),
            follow_redirects=True,
        )

    @property
    def base_url(self) -> str:
        return (self.settings.runpod_training_url or "").rstrip("/")

    def _ensure_configured(self) -> None:
        if self.mock:
            return
        if not self.base_url:
            raise RuntimeError(
                "RUNPOD_TRAINING_URL is not configured for training jobs"
            )

    async def start_job(self, request: StartJobRequest) -> StartJobResult:
        """Submit a training job (async /run preferred)."""
        if self.mock or not self.base_url:
            return self._start_mock(request)

        self._ensure_configured()
        payload = {
            "input": request.to_input_payload(
                weights_bucket=self.settings.weights_storage_bucket or None
            )
        }
        # Prefer async /run for long training jobs; fall back to /runsync.
        url = f"{self.base_url}/run"
        try:
            response = await self._client.post(
                url,
                json=payload,
                headers=self.settings.runpod_training_headers(),
            )
            if response.status_code == 404:
                url = f"{self.base_url}/runsync"
                response = await self._client.post(
                    url,
                    json=payload,
                    headers=self.settings.runpod_training_headers(),
                )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            logger.warning("training start timeout: %s", exc)
            return StartJobResult(
                ok=False,
                training_kind=request.training_kind,
                error=f"timeout: {exc}",
                meta={"url": url},
            )
        except httpx.HTTPError as exc:
            logger.warning("training start HTTP error: %s", exc)
            return StartJobResult(
                ok=False,
                training_kind=request.training_kind,
                error=f"http_error: {exc}",
                meta={"url": url},
            )

        data = _safe_json(response)
        job_id = data.get("id") or data.get("job_id")
        output = data.get("output")
        if not job_id and isinstance(output, dict):
            job_id = output.get("job_id") or output.get("id")
        if not job_id:
            job_id = f"train-{uuid.uuid4().hex[:12]}"
        status = JobStatus.from_raw(str(data.get("status") or "IN_QUEUE"))
        return StartJobResult(
            ok=True,
            job_id=str(job_id),
            status=status,
            training_kind=request.training_kind,
            meta={"url": url, "raw_status": data.get("status")},
        )

    async def get_status(self, job_id: str) -> JobStatusResult:
        """Poll job status from RunPod (or mock store)."""
        if self.mock or not self.base_url:
            return self._status_mock(job_id)

        self._ensure_configured()
        url = f"{self.base_url}/status/{job_id}"
        try:
            response = await self._client.get(
                url, headers=self.settings.runpod_training_headers()
            )
            # Some deployments use /job/{id}
            if response.status_code == 404:
                url = f"{self.base_url}/job/{job_id}"
                response = await self._client.get(
                    url, headers=self.settings.runpod_training_headers()
                )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            return JobStatusResult(
                ok=False,
                job_id=job_id,
                status=JobStatus.UNKNOWN,
                error=f"timeout: {exc}",
            )
        except httpx.HTTPError as exc:
            return JobStatusResult(
                ok=False,
                job_id=job_id,
                status=JobStatus.UNKNOWN,
                error=f"http_error: {exc}",
            )

        data = _safe_json(response)
        return _parse_status(job_id, data)

    async def get_logs(self, job_id: str, *, tail: int = 200) -> JobLogsResult:
        """Fetch training logs for a job."""
        if self.mock or not self.base_url:
            return self._logs_mock(job_id, tail=tail)

        self._ensure_configured()
        url = f"{self.base_url}/logs/{job_id}"
        try:
            response = await self._client.get(
                url,
                headers=self.settings.runpod_training_headers(),
                params={"tail": tail},
            )
            if response.status_code == 404:
                # Fall back to status endpoint output.logs
                status = await self.get_status(job_id)
                logs = ""
                if status.logs_tail:
                    logs = status.logs_tail
                elif isinstance(status.output, dict):
                    logs = str(status.output.get("logs") or "")
                return JobLogsResult(
                    ok=bool(logs) or status.ok,
                    job_id=job_id,
                    logs=logs,
                    error=None if logs else (status.error or "logs_unavailable"),
                )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            return JobLogsResult(
                ok=False, job_id=job_id, logs="", error=f"timeout: {exc}"
            )
        except httpx.HTTPError as exc:
            return JobLogsResult(
                ok=False, job_id=job_id, logs="", error=f"http_error: {exc}"
            )

        # JSON or plain text
        ctype = response.headers.get("content-type", "")
        if "application/json" in ctype:
            data = _safe_json(response)
            logs = (
                data.get("logs")
                or data.get("output", {}).get("logs")
                if isinstance(data.get("output"), dict)
                else data.get("logs")
            )
            if logs is None:
                logs = data.get("log") or ""
            return JobLogsResult(ok=True, job_id=job_id, logs=str(logs))
        return JobLogsResult(ok=True, job_id=job_id, logs=response.text)

    async def poll_until_complete(
        self,
        job_id: str,
        *,
        interval_seconds: float = 2.0,
        max_attempts: int = 3,
    ) -> JobStatusResult:
        """
        Poll status a few times (smoke / short waits). Production trainers
        should use webhooks or a background worker instead of long loops.
        """
        import asyncio

        last = await self.get_status(job_id)
        for _ in range(max(0, max_attempts - 1)):
            if last.is_terminal:
                return last
            await asyncio.sleep(interval_seconds)
            last = await self.get_status(job_id)
        return last

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Mock path (no live GPU)
    # ------------------------------------------------------------------

    def _start_mock(self, request: StartJobRequest) -> StartJobResult:
        job_id = f"mock-train-{uuid.uuid4().hex[:12]}"
        weights = None
        bucket = (self.settings.weights_storage_bucket or "").strip()
        if bucket:
            clean = bucket.rstrip("/")
            if "://" not in clean:
                clean = f"s3://{clean}"
            weights = (
                f"{clean}/weights/{request.character_id}/"
                f"{request.training_kind.value}/{job_id}"
            )
        _MOCK_JOBS[job_id] = {
            "id": job_id,
            "status": "IN_PROGRESS",
            "training_kind": request.training_kind.value,
            "character_id": request.character_id,
            "dataset_id": request.dataset_id,
            "output": {
                "weights_uri": weights,
                "logs": (
                    f"[mock] starting {request.training_kind.value} for "
                    f"{request.character_id}\n"
                    f"[mock] dataset={request.dataset_id}\n"
                ),
                "progress": 0.1,
            },
            "ticks": 0,
        }
        logger.info("mock training job started: %s", job_id)
        return StartJobResult(
            ok=True,
            job_id=job_id,
            status=JobStatus.RUNNING,
            training_kind=request.training_kind,
            provider="mock",
            meta={"mock": True},
        )

    def _status_mock(self, job_id: str) -> JobStatusResult:
        job = _MOCK_JOBS.get(job_id)
        if not job:
            return JobStatusResult(
                ok=False,
                job_id=job_id,
                status=JobStatus.UNKNOWN,
                error="job_not_found",
                provider="mock",
            )
        job["ticks"] = int(job.get("ticks") or 0) + 1
        # Complete after 2 polls
        if job["ticks"] >= 2:
            job["status"] = "COMPLETED"
            out = job.setdefault("output", {})
            out["progress"] = 1.0
            out["logs"] = (
                str(out.get("logs") or "")
                + "[mock] training complete\n"
                + f"[mock] weights → {out.get('weights_uri')}\n"
            )
        else:
            job["status"] = "IN_PROGRESS"
            out = job.setdefault("output", {})
            out["progress"] = min(0.9, 0.1 + 0.4 * job["ticks"])
            out["logs"] = (
                str(out.get("logs") or "") + f"[mock] step tick={job['ticks']}\n"
            )

        return _parse_status(job_id, job, provider="mock")

    def _logs_mock(self, job_id: str, *, tail: int = 200) -> JobLogsResult:
        job = _MOCK_JOBS.get(job_id)
        if not job:
            return JobLogsResult(
                ok=False, job_id=job_id, logs="", error="job_not_found"
            )
        logs = str((job.get("output") or {}).get("logs") or "")
        lines = logs.splitlines()
        if tail > 0 and len(lines) > tail:
            logs = "\n".join(lines[-tail:]) + ("\n" if logs.endswith("\n") else "")
        return JobLogsResult(ok=True, job_id=job_id, logs=logs)


def _parse_status(
    job_id: str, data: dict[str, Any], *, provider: str = "runpod"
) -> JobStatusResult:
    output = data.get("output")
    if not isinstance(output, dict):
        output = {} if output is None else {"value": output}

    status = JobStatus.from_raw(
        str(data.get("status") or output.get("status") or "")
    )
    progress = output.get("progress")
    if progress is None:
        progress = data.get("progress")
    try:
        progress_f = float(progress) if progress is not None else None
    except (TypeError, ValueError):
        progress_f = None

    weights_uri = (
        output.get("weights_uri")
        or output.get("weights_url")
        or output.get("output_uri")
        or data.get("weights_uri")
    )
    logs_tail = output.get("logs") or data.get("logs")
    if logs_tail is not None:
        logs_tail = str(logs_tail)
        # keep a short tail in status responses
        lines = logs_tail.splitlines()
        if len(lines) > 50:
            logs_tail = "\n".join(lines[-50:])

    error = data.get("error") or output.get("error")
    if status == JobStatus.FAILED and not error:
        error = "training_failed"

    ok = status in (JobStatus.COMPLETED, JobStatus.RUNNING, JobStatus.QUEUED) or (
        status == JobStatus.UNKNOWN and not error
    )
    if status == JobStatus.FAILED or status == JobStatus.CANCELLED:
        ok = False

    return JobStatusResult(
        ok=ok if status != JobStatus.UNKNOWN else error is None,
        job_id=str(data.get("id") or job_id),
        status=status,
        progress=progress_f,
        weights_uri=str(weights_uri) if weights_uri else None,
        logs_tail=logs_tail,
        output=output,
        raw=data,
        error=str(error) if error else None,
        provider=provider,
    )


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
        return data if isinstance(data, dict) else {"output": data}
    except Exception:
        return {"raw": response.text}
