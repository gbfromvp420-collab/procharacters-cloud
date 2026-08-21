"""
Avatar LoRA dataset helpers: asset upload staging, image/audio validation,
and caption generation for Kohya-style image folders / XTTS voice packs.
"""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import re
import struct
import uuid
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path
from typing import Any, BinaryIO

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Limits / allowed types
# ---------------------------------------------------------------------------

DEFAULT_MAX_IMAGE_BYTES = 25 * 1024 * 1024  # 25 MiB
DEFAULT_MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MiB
DEFAULT_MIN_IMAGE_SIDE = 256
DEFAULT_MAX_IMAGE_SIDE = 4096

IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".bmp"})
AUDIO_EXTENSIONS = frozenset({".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"})

IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}
AUDIO_MIME = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
}

# Magic-byte signatures (offset, bytes)
_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_WEBP_RIFF = b"RIFF"
_WEBP_WEBP = b"WEBP"
_BMP_MAGIC = b"BM"
_WAV_RIFF = b"RIFF"
_WAV_WAVE = b"WAVE"
_FLAC_MAGIC = b"fLaC"
_OGG_MAGIC = b"OggS"
_ID3_MAGIC = b"ID3"
_MP3_FRAME_SYNC_MASK = 0xFFE0


class AssetKind(str, Enum):
    IMAGE = "image"
    AUDIO = "audio"
    CAPTION = "caption"
    OTHER = "other"


@dataclass
class ValidationResult:
    ok: bool
    kind: AssetKind
    mime_type: str | None = None
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    size_bytes: int = 0
    sha256: str | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "kind": self.kind.value,
            "mime_type": self.mime_type,
            "width": self.width,
            "height": self.height,
            "duration_ms": self.duration_ms,
            "size_bytes": self.size_bytes,
            "sha256": self.sha256,
            "errors": list(self.errors),
            "warnings": list(self.warnings),
            "meta": dict(self.meta),
        }


@dataclass
class CaptionResult:
    filename: str
    caption: str
    trigger_word: str | None = None
    tags: list[str] = field(default_factory=list)
    source: str = "template"  # template | provided | auto

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "caption": self.caption,
            "trigger_word": self.trigger_word,
            "tags": list(self.tags),
            "source": self.source,
        }


@dataclass
class DatasetAsset:
    asset_id: str
    original_name: str
    stored_path: str
    kind: AssetKind
    validation: ValidationResult
    caption: CaptionResult | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "original_name": self.original_name,
            "stored_path": self.stored_path,
            "kind": self.kind.value,
            "validation": self.validation.to_dict(),
            "caption": self.caption.to_dict() if self.caption else None,
        }


@dataclass
class DatasetBuildResult:
    ok: bool
    dataset_id: str
    character_id: str
    dataset_dir: str
    assets: list[DatasetAsset] = field(default_factory=list)
    caption_count: int = 0
    image_count: int = 0
    audio_count: int = 0
    storage_uri: str | None = None
    errors: list[str] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "dataset_id": self.dataset_id,
            "character_id": self.character_id,
            "dataset_dir": self.dataset_dir,
            "assets": [a.to_dict() for a in self.assets],
            "caption_count": self.caption_count,
            "image_count": self.image_count,
            "audio_count": self.audio_count,
            "storage_uri": self.storage_uri,
            "errors": list(self.errors),
            "meta": dict(self.meta),
        }


# ---------------------------------------------------------------------------
# Low-level validation
# ---------------------------------------------------------------------------


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _detect_image(data: bytes) -> tuple[str | None, int | None, int | None, list[str]]:
    """Return (mime, width, height, errors) from raw bytes (no Pillow required)."""
    errors: list[str] = []
    if len(data) < 12:
        return None, None, None, ["image too small to parse header"]

    if data[:3] == _JPEG_MAGIC:
        w, h = _jpeg_size(data)
        return "image/jpeg", w, h, errors
    if data[:8] == _PNG_MAGIC:
        w, h = _png_size(data)
        return "image/png", w, h, errors
    if data[:4] == _WEBP_RIFF and data[8:12] == _WEBP_WEBP:
        w, h = _webp_size(data)
        return "image/webp", w, h, errors
    if data[:2] == _BMP_MAGIC:
        w, h = _bmp_size(data)
        return "image/bmp", w, h, errors

    errors.append("unrecognized image magic bytes (expected JPEG/PNG/WEBP/BMP)")
    return None, None, None, errors


def _png_size(data: bytes) -> tuple[int | None, int | None]:
    # IHDR at offset 16: width u32be, height u32be
    if len(data) < 24:
        return None, None
    w, h = struct.unpack(">II", data[16:24])
    return int(w), int(h)


def _bmp_size(data: bytes) -> tuple[int | None, int | None]:
    if len(data) < 26:
        return None, None
    # BITMAPINFOHEADER: width/height at offset 18 as i32 le
    w, h = struct.unpack("<ii", data[18:26])
    return abs(int(w)), abs(int(h))


def _jpeg_size(data: bytes) -> tuple[int | None, int | None]:
    i = 2
    n = len(data)
    while i + 9 < n:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        i += 2
        # SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry size
        if marker in (
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        ):
            if i + 7 > n:
                return None, None
            # length(2) precision(1) height(2) width(2)
            h, w = struct.unpack(">HH", data[i + 3 : i + 7])
            return int(w), int(h)
        if marker in (0xD8, 0xD9) or (0xD0 <= marker <= 0xD7):
            continue
        if i + 2 > n:
            break
        seg_len = struct.unpack(">H", data[i : i + 2])[0]
        if seg_len < 2:
            break
        i += seg_len
    return None, None


def _webp_size(data: bytes) -> tuple[int | None, int | None]:
    # Minimal VP8 / VP8L / VP8X parsing
    if len(data) < 30:
        return None, None
    chunk = data[12:16]
    if chunk == b"VP8X" and len(data) >= 30:
        # canvas size is 24-bit little-endian minus 1
        w = 1 + int.from_bytes(data[24:27], "little")
        h = 1 + int.from_bytes(data[27:30], "little")
        return w, h
    # lossy: start code 0x9d012a then 14-bit width/height
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        w = struct.unpack("<H", data[26:28])[0] & 0x3FFF
        h = struct.unpack("<H", data[28:30])[0] & 0x3FFF
        return w, h
    # signature 0x2f then 14-bit w-1 / h-1 packed
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = struct.unpack("<I", data[21:25])[0]
        w = (bits & 0x3FFF) + 1
        h = ((bits >> 14) & 0x3FFF) + 1
        return w, h
    return None, None


def _detect_audio(data: bytes) -> tuple[str | None, int | None, list[str]]:
    """Return (mime, duration_ms|None, errors)."""
    errors: list[str] = []
    if len(data) < 12:
        return None, None, ["audio too small to parse header"]

    if data[:4] == _WAV_RIFF and data[8:12] == _WAV_WAVE:
        dur = _wav_duration_ms(data)
        return "audio/wav", dur, errors
    if data[:4] == _FLAC_MAGIC:
        return "audio/flac", None, errors
    if data[:4] == _OGG_MAGIC:
        return "audio/ogg", None, errors
    if data[:3] == _ID3_MAGIC or _looks_like_mp3_frame(data):
        return "audio/mpeg", None, errors
    # ftyp-based m4a
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "audio/mp4", None, errors

    errors.append("unrecognized audio magic bytes (expected WAV/MP3/FLAC/OGG/M4A)")
    return None, None, errors


def _looks_like_mp3_frame(data: bytes) -> bool:
    if len(data) < 2:
        return False
    # MPEG frame sync 11 bits set
    word = (data[0] << 8) | data[1]
    return (word & _MP3_FRAME_SYNC_MASK) == _MP3_FRAME_SYNC_MASK


def _wav_duration_ms(data: bytes) -> int | None:
    """Parse PCM WAV for approximate duration."""
    try:
        # Find fmt and data chunks
        pos = 12
        sample_rate = None
        channels = None
        bits = None
        data_size = None
        while pos + 8 <= len(data):
            chunk_id = data[pos : pos + 4]
            chunk_size = struct.unpack("<I", data[pos + 4 : pos + 8])[0]
            body = pos + 8
            if chunk_id == b"fmt " and chunk_size >= 16 and body + 16 <= len(data):
                channels = struct.unpack("<H", data[body + 2 : body + 4])[0]
                sample_rate = struct.unpack("<I", data[body + 4 : body + 8])[0]
                bits = struct.unpack("<H", data[body + 14 : body + 16])[0]
            elif chunk_id == b"data":
                data_size = chunk_size
                break
            pos = body + chunk_size + (chunk_size % 2)
        if sample_rate and channels and bits and data_size:
            bytes_per_sec = sample_rate * channels * (bits // 8)
            if bytes_per_sec > 0:
                return int(data_size * 1000 / bytes_per_sec)
    except Exception:  # noqa: BLE001 — best-effort duration
        return None
    return None


def guess_kind_from_name(filename: str) -> AssetKind:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return AssetKind.IMAGE
    if ext in AUDIO_EXTENSIONS:
        return AssetKind.AUDIO
    if ext in {".txt", ".caption", ".cap"}:
        return AssetKind.CAPTION
    mime, _ = mimetypes.guess_type(filename)
    if mime and mime.startswith("image/"):
        return AssetKind.IMAGE
    if mime and mime.startswith("audio/"):
        return AssetKind.AUDIO
    return AssetKind.OTHER


def validate_image_bytes(
    data: bytes,
    *,
    filename: str = "image.bin",
    max_bytes: int = DEFAULT_MAX_IMAGE_BYTES,
    min_side: int = DEFAULT_MIN_IMAGE_SIDE,
    max_side: int = DEFAULT_MAX_IMAGE_SIDE,
) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    size = len(data)
    if size == 0:
        errors.append("empty file")
    if size > max_bytes:
        errors.append(f"image exceeds max size {max_bytes} bytes ({size})")

    mime, width, height, parse_errors = _detect_image(data)
    errors.extend(parse_errors)

    ext = Path(filename).suffix.lower()
    if ext and ext not in IMAGE_EXTENSIONS:
        warnings.append(f"unexpected image extension {ext!r}")

    if width is not None and height is not None:
        if width < min_side or height < min_side:
            errors.append(f"image too small ({width}x{height}); min side {min_side}px")
        if width > max_side or height > max_side:
            warnings.append(f"image very large ({width}x{height}); max recommended {max_side}px")
        if abs(width - height) / max(width, height) > 0.5:
            warnings.append("highly non-square aspect ratio may hurt avatar LoRA consistency")
    elif mime and not parse_errors:
        warnings.append("could not determine image dimensions")

    ok = not errors and mime is not None
    return ValidationResult(
        ok=ok,
        kind=AssetKind.IMAGE,
        mime_type=mime,
        width=width,
        height=height,
        size_bytes=size,
        sha256=_sha256_bytes(data) if data else None,
        errors=errors,
        warnings=warnings,
        meta={"filename": filename},
    )


def validate_audio_bytes(
    data: bytes,
    *,
    filename: str = "audio.bin",
    max_bytes: int = DEFAULT_MAX_AUDIO_BYTES,
    min_duration_ms: int = 500,
    max_duration_ms: int = 120_000,
) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    size = len(data)
    if size == 0:
        errors.append("empty file")
    if size > max_bytes:
        errors.append(f"audio exceeds max size {max_bytes} bytes ({size})")

    mime, duration_ms, parse_errors = _detect_audio(data)
    errors.extend(parse_errors)

    ext = Path(filename).suffix.lower()
    if ext and ext not in AUDIO_EXTENSIONS:
        warnings.append(f"unexpected audio extension {ext!r}")

    if duration_ms is not None:
        if duration_ms < min_duration_ms:
            errors.append(f"audio too short ({duration_ms}ms); min {min_duration_ms}ms")
        if duration_ms > max_duration_ms:
            warnings.append(f"audio long ({duration_ms}ms); max recommended {max_duration_ms}ms")
    else:
        warnings.append("could not determine audio duration")

    ok = not errors and mime is not None
    return ValidationResult(
        ok=ok,
        kind=AssetKind.AUDIO,
        mime_type=mime,
        duration_ms=duration_ms,
        size_bytes=size,
        sha256=_sha256_bytes(data) if data else None,
        errors=errors,
        warnings=warnings,
        meta={"filename": filename},
    )


def validate_asset_bytes(
    data: bytes,
    *,
    filename: str,
    kind: AssetKind | None = None,
) -> ValidationResult:
    resolved = kind or guess_kind_from_name(filename)
    if resolved == AssetKind.IMAGE:
        return validate_image_bytes(data, filename=filename)
    if resolved == AssetKind.AUDIO:
        return validate_audio_bytes(data, filename=filename)
    if resolved == AssetKind.CAPTION:
        text_ok = len(data) > 0
        return ValidationResult(
            ok=text_ok,
            kind=AssetKind.CAPTION,
            mime_type="text/plain",
            size_bytes=len(data),
            sha256=_sha256_bytes(data) if data else None,
            errors=[] if text_ok else ["empty caption"],
            meta={"filename": filename},
        )
    return ValidationResult(
        ok=False,
        kind=AssetKind.OTHER,
        size_bytes=len(data),
        sha256=_sha256_bytes(data) if data else None,
        errors=[f"unsupported asset type for {filename!r}"],
        meta={"filename": filename},
    )


# ---------------------------------------------------------------------------
# Captioning
# ---------------------------------------------------------------------------

_DEFAULT_TAGS = (
    "1girl",
    "solo",
    "looking_at_viewer",
    "upper_body",
    "high_quality",
)


def build_caption(
    *,
    filename: str,
    character_id: str,
    trigger_word: str | None = None,
    provided_caption: str | None = None,
    extra_tags: Iterable[str] | None = None,
    style: str = "avatar_lora",
) -> CaptionResult:
    """
    Build a Kohya-friendly caption string.

    Prefer caller-supplied captions; otherwise emit a structured template with
    trigger word + quality/pose tags suitable for avatar LoRA datasets.
    """
    trigger = (trigger_word or _slug_trigger(character_id)).strip()
    tags: list[str] = []

    if provided_caption and provided_caption.strip():
        caption = provided_caption.strip()
        # Ensure trigger appears for multi-concept datasets
        if trigger and trigger.lower() not in caption.lower():
            caption = f"{trigger}, {caption}"
        source = "provided"
        tags = _split_tags(caption)
    else:
        tags = [trigger] if trigger else []
        tags.extend(_DEFAULT_TAGS)
        if extra_tags:
            for t in extra_tags:
                t = t.strip()
                if t and t not in tags:
                    tags.append(t)
        if style == "xtts_voice":
            caption = f"Voice sample for character {character_id}" + (
                f" ({trigger})" if trigger else ""
            )
            source = "template"
        else:
            caption = ", ".join(tags)
            source = "template"

    # Kohya pair files use the image stem + .txt
    cap_name = Path(filename).with_suffix(".txt").name
    return CaptionResult(
        filename=cap_name,
        caption=caption,
        trigger_word=trigger or None,
        tags=tags if tags else _split_tags(caption),
        source=source,
    )


def _slug_trigger(character_id: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "", character_id).lower()
    return slug or "char"


def _split_tags(caption: str) -> list[str]:
    parts = re.split(r"[,;\n]+", caption)
    return [p.strip() for p in parts if p.strip()]


# ---------------------------------------------------------------------------
# Dataset service
# ---------------------------------------------------------------------------


class DatasetService:
    """
    Stage avatar LoRA / voice fine-tune assets under a local dataset directory
    (and optionally reference a weights/dataset storage bucket URI).
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        root_dir: str | Path | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        if root_dir is not None:
            self.root_dir = Path(root_dir)
        else:
            self.root_dir = Path(
                getattr(self.settings, "trainer_dataset_root", None) or "data/trainer/datasets"
            )
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _storage_uri(self, dataset_id: str, character_id: str) -> str | None:
        bucket = (self.settings.weights_storage_bucket or "").strip()
        if not bucket:
            return None
        # s3://bucket/datasets/{character}/{dataset_id}
        clean = bucket.rstrip("/")
        if "://" not in clean:
            clean = f"s3://{clean}"
        return f"{clean}/datasets/{character_id}/{dataset_id}"

    def create_dataset(
        self,
        *,
        character_id: str,
        files: list[tuple[str, bytes]],
        captions: dict[str, str] | None = None,
        trigger_word: str | None = None,
        extra_tags: list[str] | None = None,
        dataset_id: str | None = None,
    ) -> DatasetBuildResult:
        """
        Validate + stage uploaded assets and write caption .txt sidecars.

        `files` is a list of (original_filename, raw_bytes).
        `captions` maps original filename (or stem) -> caption text.
        """
        character_id = (character_id or "default").strip() or "default"
        ds_id = dataset_id or uuid.uuid4().hex[:16]
        ds_dir = self.root_dir / character_id / ds_id
        images_dir = ds_dir / "images"
        audio_dir = ds_dir / "audio"
        images_dir.mkdir(parents=True, exist_ok=True)
        audio_dir.mkdir(parents=True, exist_ok=True)

        captions = captions or {}
        assets: list[DatasetAsset] = []
        errors: list[str] = []
        image_count = 0
        audio_count = 0
        caption_count = 0

        for original_name, raw in files:
            safe_name = _safe_filename(original_name)
            kind = guess_kind_from_name(safe_name)
            validation = validate_asset_bytes(raw, filename=safe_name, kind=kind)

            if not validation.ok:
                errors.append(f"{safe_name}: {'; '.join(validation.errors)}")
                assets.append(
                    DatasetAsset(
                        asset_id=uuid.uuid4().hex[:12],
                        original_name=original_name,
                        stored_path="",
                        kind=kind,
                        validation=validation,
                    )
                )
                continue

            if kind == AssetKind.IMAGE:
                dest = images_dir / safe_name
                dest.write_bytes(raw)
                image_count += 1
                provided = _lookup_caption(captions, original_name, safe_name)
                cap = build_caption(
                    filename=safe_name,
                    character_id=character_id,
                    trigger_word=trigger_word,
                    provided_caption=provided,
                    extra_tags=extra_tags,
                    style="avatar_lora",
                )
                cap_path = images_dir / cap.filename
                cap_path.write_text(cap.caption + "\n", encoding="utf-8")
                caption_count += 1
                assets.append(
                    DatasetAsset(
                        asset_id=uuid.uuid4().hex[:12],
                        original_name=original_name,
                        stored_path=str(dest),
                        kind=kind,
                        validation=validation,
                        caption=cap,
                    )
                )
            elif kind == AssetKind.AUDIO:
                dest = audio_dir / safe_name
                dest.write_bytes(raw)
                audio_count += 1
                provided = _lookup_caption(captions, original_name, safe_name)
                cap = build_caption(
                    filename=safe_name,
                    character_id=character_id,
                    trigger_word=trigger_word,
                    provided_caption=provided,
                    extra_tags=extra_tags,
                    style="xtts_voice",
                )
                # Optional transcript sidecar next to audio
                cap_path = audio_dir / cap.filename
                cap_path.write_text(cap.caption + "\n", encoding="utf-8")
                caption_count += 1
                assets.append(
                    DatasetAsset(
                        asset_id=uuid.uuid4().hex[:12],
                        original_name=original_name,
                        stored_path=str(dest),
                        kind=kind,
                        validation=validation,
                        caption=cap,
                    )
                )
            elif kind == AssetKind.CAPTION:
                dest = images_dir / safe_name
                dest.write_bytes(raw)
                caption_count += 1
                assets.append(
                    DatasetAsset(
                        asset_id=uuid.uuid4().hex[:12],
                        original_name=original_name,
                        stored_path=str(dest),
                        kind=kind,
                        validation=validation,
                    )
                )
            else:
                errors.append(f"{safe_name}: unsupported kind")

        # Manifest for training workers / retune jobs
        manifest = {
            "dataset_id": ds_id,
            "character_id": character_id,
            "created_at": datetime.now(UTC).isoformat(),
            "image_count": image_count,
            "audio_count": audio_count,
            "caption_count": caption_count,
            "trigger_word": trigger_word or _slug_trigger(character_id),
            "assets": [a.to_dict() for a in assets if a.validation.ok],
            "weights_storage_bucket": self.settings.weights_storage_bucket or None,
        }
        (ds_dir / "manifest.json").write_text(_json_dumps(manifest), encoding="utf-8")

        # ok when at least one media asset staged; validation failures stay in errors[]
        ok = (image_count + audio_count) > 0

        result = DatasetBuildResult(
            ok=ok,
            dataset_id=ds_id,
            character_id=character_id,
            dataset_dir=str(ds_dir),
            assets=assets,
            caption_count=caption_count,
            image_count=image_count,
            audio_count=audio_count,
            storage_uri=self._storage_uri(ds_id, character_id),
            errors=list(errors),
            meta={
                "trigger_word": trigger_word or _slug_trigger(character_id),
                "manifest_path": str(ds_dir / "manifest.json"),
            },
        )
        logger.info(
            "dataset %s character=%s images=%s audio=%s ok=%s",
            ds_id,
            character_id,
            image_count,
            audio_count,
            ok,
        )
        return result

    def validate_only(
        self,
        files: list[tuple[str, bytes]],
    ) -> list[ValidationResult]:
        """Validate assets without writing them to disk."""
        out: list[ValidationResult] = []
        for name, raw in files:
            out.append(validate_asset_bytes(raw, filename=name))
        return out

    def get_dataset_dir(self, character_id: str, dataset_id: str) -> Path | None:
        path = self.root_dir / character_id / dataset_id
        return path if path.is_dir() else None


def _safe_filename(name: str) -> str:
    base = Path(name).name
    base = re.sub(r"[^\w.\-]+", "_", base)
    if not base or base in {".", ".."}:
        base = f"asset_{uuid.uuid4().hex[:8]}.bin"
    return base


def _lookup_caption(captions: dict[str, str], original_name: str, safe_name: str) -> str | None:
    if original_name in captions:
        return captions[original_name]
    if safe_name in captions:
        return captions[safe_name]
    stem = Path(safe_name).stem
    if stem in captions:
        return captions[stem]
    # also try original stem
    ostem = Path(original_name).stem
    if ostem in captions:
        return captions[ostem]
    return None


def _json_dumps(obj: Any) -> str:
    import json

    return json.dumps(obj, indent=2, ensure_ascii=False) + "\n"


def read_upload_bytes(file_obj: BinaryIO, *, max_bytes: int | None = None) -> bytes:
    """Read an upload stream with an optional size cap."""
    data = file_obj.read()
    if max_bytes is not None and len(data) > max_bytes:
        raise ValueError(f"upload exceeds {max_bytes} bytes")
    return data
