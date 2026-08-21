"""
Trainer / fine-tune API routes.

  POST /api/v1/trainer/dataset          (JSON base64 assets)
  POST /api/v1/trainer/dataset/upload   (multipart binary files)
  POST /api/v1/trainer/start-job
  GET  /api/v1/trainer/status/{job_id}
  GET  /api/v1/trainer/weights
  POST /api/v1/trainer/weights/register
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services.trainer.dataset import DatasetService
from app.services.trainer.registry import (
    WeightKind,
    get_weight_registry,
)
from app.services.trainer.runpod_job import (
    StartJobRequest,
    TrainingJobClient,
    TrainingKind,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/trainer", tags=["trainer"])

# python-multipart is required for Form/File routes; fail clearly if missing.
try:
    import multipart as _multipart  # noqa: F401

    _MULTIPART_AVAILABLE = True
except ImportError:  # pragma: no cover
    _MULTIPART_AVAILABLE = False


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class StartJobBody(BaseModel):
    training_kind: TrainingKind = Field(
        default=TrainingKind.KOHYA_SS,
        description="kohya_ss | unsloth | xtts",
    )
    character_id: str = Field(..., min_length=1)
    dataset_id: str = Field(..., min_length=1)
    dataset_dir: str | None = None
    dataset_uri: str | None = None
    trigger_word: str | None = None
    base_model: str | None = None
    output_name: str | None = None
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)
    mock: bool = Field(
        default=False,
        description="Force mock dispatch (no remote RunPod call)",
    )
    register_on_complete: bool = Field(
        default=True,
        description="When mock-completing, register resulting weights in the registry",
    )


class DatasetAssetIn(BaseModel):
    filename: str = Field(..., min_length=1)
    content_b64: str | None = Field(default=None, description="Base64-encoded file bytes")
    content_text: str | None = Field(
        default=None, description="UTF-8 text (captions / transcripts)"
    )


class DatasetCreateBody(BaseModel):
    """Create an avatar LoRA / voice dataset from base64 (or text) assets."""

    character_id: str = Field(..., min_length=1)
    trigger_word: str | None = None
    extra_tags: list[str] = Field(default_factory=list)
    captions: dict[str, str] = Field(
        default_factory=dict,
        description="Optional map of filename (or stem) → caption text",
    )
    assets: list[DatasetAssetIn] = Field(
        default_factory=list,
        description="Image/audio assets (at least one required)",
    )


class RegisterWeightBody(BaseModel):
    character_id: str = Field(..., min_length=1)
    kind: str = Field(
        ...,
        description="visual_lora | llm | voice | kohya_ss | unsloth | xtts",
    )
    uri: str | None = None
    weight_id: str | None = None
    lora_id: str | None = None
    label: str | None = None
    base_model: str | None = None
    trigger_word: str | None = None
    job_id: str | None = None
    set_active: bool = True
    meta: dict[str, Any] = Field(default_factory=dict)


class SetActiveWeightBody(BaseModel):
    character_id: str = Field(..., min_length=1)
    kind: str = Field(..., min_length=1)
    weight_id: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _dataset_service() -> DatasetService:
    return DatasetService(get_settings())


def _job_client(*, mock: bool = False) -> TrainingJobClient:
    settings = get_settings()
    # Auto-mock when training URL is unset (local smoke / CI)
    use_mock = mock or not (settings.runpod_training_url or "").strip()
    return TrainingJobClient(settings, mock=use_mock)


def _decode_assets(assets: list[DatasetAssetIn]) -> list[tuple[str, bytes]]:
    file_pairs: list[tuple[str, bytes]] = []
    for asset in assets:
        name = asset.filename
        if asset.content_b64 is not None:
            try:
                raw = base64.b64decode(asset.content_b64, validate=False)
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"invalid base64 for {name}: {exc}",
                ) from exc
        elif asset.content_text is not None:
            raw = asset.content_text.encode("utf-8")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"asset {name} missing content_b64 or content_text",
            )
        file_pairs.append((name, raw))
    return file_pairs


def _parse_extra_tags(extra_tags: str | None) -> list[str]:
    if not extra_tags:
        return []
    raw_tags = extra_tags.strip()
    if raw_tags.startswith("["):
        try:
            parsed = json.loads(raw_tags)
            if isinstance(parsed, list):
                return [str(t) for t in parsed]
        except json.JSONDecodeError:
            pass
    return [t.strip() for t in raw_tags.split(",") if t.strip()]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("")
async def trainer_root() -> dict[str, Any]:
    """Discovery surface for the trainer API."""
    settings = get_settings()
    return {
        "service": "trainer",
        "version": "v1",
        "endpoints": [
            "POST /api/v1/trainer/dataset",
            "POST /api/v1/trainer/dataset/upload",
            "POST /api/v1/trainer/start-job",
            "GET  /api/v1/trainer/status/{job_id}",
            "GET  /api/v1/trainer/weights",
            "POST /api/v1/trainer/weights/register",
        ],
        "training_kinds": [k.value for k in TrainingKind],
        "multipart_available": _MULTIPART_AVAILABLE,
        "configured": {
            "runpod_training_url": bool(settings.runpod_training_url),
            "weights_storage_bucket": bool(settings.weights_storage_bucket),
        },
    }


@router.post("/dataset")
async def create_dataset(body: DatasetCreateBody) -> dict[str, Any]:
    """
    Validate assets, write captions, and stage an avatar LoRA / XTTS dataset.

    Body is JSON with base64-encoded assets.
    """
    if not body.assets:
        raise HTTPException(status_code=400, detail="no assets provided")

    file_pairs = _decode_assets(body.assets)
    service = _dataset_service()
    result = service.create_dataset(
        character_id=body.character_id,
        files=file_pairs,
        captions=body.captions,
        trigger_word=body.trigger_word,
        extra_tags=body.extra_tags or None,
    )
    if not result.ok:
        logger.warning(
            "dataset build incomplete character=%s errors=%s",
            body.character_id,
            result.errors,
        )
    return result.to_dict()


@router.post("/dataset/upload")
async def create_dataset_upload(
    character_id: str = Form(..., min_length=1),
    trigger_word: str | None = Form(default=None),
    extra_tags: str | None = Form(
        default=None,
        description="Comma-separated tags or JSON list string",
    ),
    captions_json: str | None = Form(
        default=None,
        description='JSON object mapping filename → caption, e.g. {"a.png":"…"}',
    ),
    files: list[UploadFile] = File(..., description="Binary image/audio assets"),
) -> dict[str, Any]:
    """
    Multipart binary upload path (requires python-multipart).

    Form fields: character_id, optional trigger_word / extra_tags / captions_json,
    plus one or more files.
    """
    if not _MULTIPART_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="python-multipart is not installed; use POST /dataset with JSON base64",
        )

    captions: dict[str, str] = {}
    if captions_json:
        try:
            parsed = json.loads(captions_json)
            if isinstance(parsed, dict):
                captions = {str(k): str(v) for k, v in parsed.items()}
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail=f"captions_json is not valid JSON: {exc}"
            ) from exc

    file_pairs: list[tuple[str, bytes]] = []
    for uf in files:
        name = uf.filename or "upload.bin"
        raw = await uf.read()
        file_pairs.append((name, raw))

    if not file_pairs:
        raise HTTPException(status_code=400, detail="no assets uploaded")

    service = _dataset_service()
    result = service.create_dataset(
        character_id=character_id,
        files=file_pairs,
        captions=captions,
        trigger_word=trigger_word,
        extra_tags=_parse_extra_tags(extra_tags) or None,
    )
    return result.to_dict()


@router.post("/start-job")
async def start_job(body: StartJobBody) -> dict[str, Any]:
    """Dispatch a remote RunPod training job (Kohya_ss / Unsloth / XTTS)."""
    settings = get_settings()
    client = _job_client(mock=body.mock)
    try:
        dataset_dir = body.dataset_dir
        if not dataset_dir:
            ds = _dataset_service().get_dataset_dir(body.character_id, body.dataset_id)
            if ds is not None:
                dataset_dir = str(ds)

        req = StartJobRequest(
            training_kind=body.training_kind,
            character_id=body.character_id,
            dataset_id=body.dataset_id,
            dataset_dir=dataset_dir,
            dataset_uri=body.dataset_uri,
            trigger_word=body.trigger_word,
            base_model=body.base_model,
            output_name=body.output_name,
            hyperparameters=body.hyperparameters,
            extra={
                **(body.extra or {}),
                "weights_storage_bucket": settings.weights_storage_bucket or None,
            },
        )
        result = await client.start_job(req)
        if not result.ok:
            raise HTTPException(
                status_code=502,
                detail=result.error or "failed to start training job",
            )

        payload = result.to_dict()

        # For mock jobs, advance to completion and optionally register weights
        if result.provider == "mock" and result.job_id and body.register_on_complete:
            st = await client.get_status(result.job_id)
            st = await client.get_status(result.job_id)  # 2nd poll → COMPLETED
            if st.weights_uri:
                kind = WeightKind.from_training_kind(body.training_kind.value)
                entry = get_weight_registry(settings).register(
                    character_id=body.character_id,
                    kind=kind,
                    uri=st.weights_uri,
                    weight_id=result.job_id,
                    lora_id=result.job_id if kind == WeightKind.VISUAL_LORA else None,
                    trigger_word=body.trigger_word,
                    base_model=body.base_model,
                    job_id=result.job_id,
                    set_active=True,
                    meta={"source": "mock_training", "dataset_id": body.dataset_id},
                )
                payload["registered_weight"] = entry.to_dict()
                payload["status"] = st.status.value
                payload["weights_uri"] = st.weights_uri

        return payload
    finally:
        await client.aclose()


@router.get("/status/{job_id}")
async def job_status(job_id: str, mock: bool = False) -> dict[str, Any]:
    """Poll training job status (includes a short logs tail when available)."""
    client = _job_client(mock=mock)
    try:
        status = await client.get_status(job_id)
        if not status.ok and status.error == "job_not_found":
            raise HTTPException(status_code=404, detail=f"job not found: {job_id}")
        if not status.ok and status.error and "http_error" in status.error:
            raise HTTPException(status_code=502, detail=status.error)
        return status.to_dict()
    finally:
        await client.aclose()


@router.get("/logs/{job_id}")
async def job_logs(job_id: str, tail: int = 200, mock: bool = False) -> dict[str, Any]:
    """Fetch training logs for a job (helper endpoint for operators)."""
    client = _job_client(mock=mock)
    try:
        logs = await client.get_logs(job_id, tail=tail)
        if not logs.ok and logs.error == "job_not_found":
            raise HTTPException(status_code=404, detail=f"job not found: {job_id}")
        return logs.to_dict()
    finally:
        await client.aclose()


# ---------------------------------------------------------------------------
# Weight registry
# ---------------------------------------------------------------------------


@router.get("/weights")
async def list_weights(
    character_id: str | None = None,
    kind: str | None = None,
) -> dict[str, Any]:
    """List indexed character weights / LoRAs / voice models."""
    registry = get_weight_registry(get_settings())
    entries = registry.list_weights(character_id=character_id, kind=kind)
    return {
        "ok": True,
        "summary": registry.summary(),
        "weights": [e.to_dict() for e in entries],
    }


@router.get("/weights/resolve")
async def resolve_weights(
    character_id: str,
    lora_id: str | None = None,
) -> dict[str, Any]:
    """Resolve active weights for a character (optional lora override)."""
    registry = get_weight_registry(get_settings())
    resolved = registry.resolve(character_id, lora_id=lora_id)
    return {"ok": True, **resolved.to_dict()}


@router.post("/weights/register")
async def register_weight(body: RegisterWeightBody) -> dict[str, Any]:
    """Register a trained weight artifact into the live inference index."""
    registry = get_weight_registry(get_settings())
    try:
        entry = registry.register(
            character_id=body.character_id,
            kind=body.kind,
            uri=body.uri,
            weight_id=body.weight_id,
            lora_id=body.lora_id,
            label=body.label,
            base_model=body.base_model,
            trigger_word=body.trigger_word,
            job_id=body.job_id,
            set_active=body.set_active,
            meta=body.meta,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "weight": entry.to_dict()}


@router.post("/weights/active")
async def set_active_weight(body: SetActiveWeightBody) -> dict[str, Any]:
    """Mark a weight as the active binding for a character + kind."""
    registry = get_weight_registry(get_settings())
    try:
        entry = registry.set_active(body.character_id, body.kind, body.weight_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "weight": entry.to_dict()}
