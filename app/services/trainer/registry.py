"""
Character weight registry — indexes visual LoRAs, LLM adapters, and voice models
under WEIGHTS_STORAGE_BUCKET (and an optional local mirror for smoke / offline).

Layout convention (object storage or local):
  {bucket}/weights/{character_id}/{kind}/{weight_id}/
  {bucket}/weights/{character_id}/{kind}/{weight_id}/manifest.json

Kinds:
  kohya_ss | visual_lora  → avatar / MuseTalk visual LoRA
  unsloth  | llm          → character LLM adapter
  xtts     | voice        → XTTS voice pack
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Iterable

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class WeightKind(str, Enum):
    VISUAL_LORA = "visual_lora"
    LLM = "llm"
    VOICE = "voice"

    @classmethod
    def from_training_kind(cls, value: str | None) -> WeightKind:
        v = (value or "").strip().lower()
        mapping = {
            "kohya_ss": cls.VISUAL_LORA,
            "kohya": cls.VISUAL_LORA,
            "visual_lora": cls.VISUAL_LORA,
            "lora": cls.VISUAL_LORA,
            "unsloth": cls.LLM,
            "llm": cls.LLM,
            "xtts": cls.VOICE,
            "voice": cls.VOICE,
        }
        if v not in mapping:
            raise ValueError(f"unknown weight/training kind: {value!r}")
        return mapping[v]

    @classmethod
    def coerce(cls, value: str | WeightKind) -> WeightKind:
        if isinstance(value, cls):
            return value
        return cls.from_training_kind(str(value))


@dataclass
class WeightEntry:
    """A single indexed weight artifact ready for inference binding."""

    weight_id: str
    character_id: str
    kind: WeightKind
    uri: str
    lora_id: str | None = None  # alias — visual LoRAs often addressed by lora_id
    label: str | None = None
    base_model: str | None = None
    trigger_word: str | None = None
    job_id: str | None = None
    active: bool = True
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["kind"] = self.kind.value
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WeightEntry:
        kind = WeightKind.coerce(data.get("kind") or "visual_lora")
        return cls(
            weight_id=str(data.get("weight_id") or data.get("id") or uuid.uuid4().hex[:12]),
            character_id=str(data.get("character_id") or "default"),
            kind=kind,
            uri=str(data.get("uri") or data.get("weights_uri") or ""),
            lora_id=data.get("lora_id") or data.get("weight_id"),
            label=data.get("label"),
            base_model=data.get("base_model"),
            trigger_word=data.get("trigger_word"),
            job_id=data.get("job_id"),
            active=bool(data.get("active", True)),
            created_at=str(data.get("created_at") or datetime.now(timezone.utc).isoformat()),
            meta=dict(data.get("meta") or {}),
        )


@dataclass
class CharacterWeights:
    """Resolved set of active weights for a character (and optional lora override)."""

    character_id: str
    lora_id: str | None = None
    visual_lora: WeightEntry | None = None
    llm: WeightEntry | None = None
    voice: WeightEntry | None = None

    @property
    def visual_lora_uri(self) -> str | None:
        return self.visual_lora.uri if self.visual_lora else None

    @property
    def llm_weights_uri(self) -> str | None:
        return self.llm.uri if self.llm else None

    @property
    def voice_model_uri(self) -> str | None:
        return self.voice.uri if self.voice else None

    def to_inference_payload(self) -> dict[str, Any]:
        """Flattened dict suitable for RunPod input / request.extra."""
        payload: dict[str, Any] = {
            "character_id": self.character_id,
        }
        if self.lora_id:
            payload["lora_id"] = self.lora_id
        if self.visual_lora:
            payload["visual_lora_uri"] = self.visual_lora.uri
            payload["lora_uri"] = self.visual_lora.uri
            payload["lora_id"] = self.lora_id or self.visual_lora.lora_id or self.visual_lora.weight_id
            if self.visual_lora.trigger_word:
                payload["trigger_word"] = self.visual_lora.trigger_word
            if self.visual_lora.base_model:
                payload["visual_base_model"] = self.visual_lora.base_model
        if self.llm:
            payload["llm_weights_uri"] = self.llm.uri
            payload["adapter_uri"] = self.llm.uri
            if self.llm.base_model:
                payload["llm_base_model"] = self.llm.base_model
                payload["model"] = self.llm.base_model
        if self.voice:
            payload["voice_model_uri"] = self.voice.uri
            payload["xtts_uri"] = self.voice.uri
        return payload

    def to_dict(self) -> dict[str, Any]:
        return {
            "character_id": self.character_id,
            "lora_id": self.lora_id,
            "visual_lora": self.visual_lora.to_dict() if self.visual_lora else None,
            "llm": self.llm.to_dict() if self.llm else None,
            "voice": self.voice.to_dict() if self.voice else None,
            "inference": self.to_inference_payload(),
        }


class WeightRegistry:
    """
    In-process + on-disk index of trained weights.

    Primary source of truth for smoke/local is a JSON index under
    `data/trainer/weights/index.json`, optionally mirroring
    WEIGHTS_STORAGE_BUCKET layout. Entries can also be registered after
    training jobs complete.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        root_dir: str | Path | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.root_dir = Path(root_dir) if root_dir else Path("data/trainer/weights")
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.root_dir / "index.json"
        self._lock = threading.RLock()
        self._entries: dict[str, WeightEntry] = {}
        # character_id -> kind -> weight_id (active selection)
        self._active: dict[str, dict[str, str]] = {}
        self._loaded_at: float | None = None
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self) -> None:
        with self._lock:
            self._entries.clear()
            self._active.clear()
            if self.index_path.is_file():
                try:
                    raw = json.loads(self.index_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as exc:
                    logger.warning("weight index unreadable: %s", exc)
                    raw = {}
                for item in raw.get("entries") or []:
                    if not isinstance(item, dict):
                        continue
                    entry = WeightEntry.from_dict(item)
                    if entry.uri:
                        self._entries[entry.weight_id] = entry
                active = raw.get("active") or {}
                if isinstance(active, dict):
                    for cid, kinds in active.items():
                        if isinstance(kinds, dict):
                            self._active[str(cid)] = {
                                str(k): str(v) for k, v in kinds.items()
                            }
            # Also scan local directory tree for manifests
            self._scan_local_tree()
            self._loaded_at = time.time()

    def _scan_local_tree(self) -> None:
        """Discover weight dirs: root/{character}/{kind}/{weight_id}/manifest.json."""
        if not self.root_dir.is_dir():
            return
        for char_dir in self.root_dir.iterdir():
            if not char_dir.is_dir() or char_dir.name.startswith("."):
                continue
            if char_dir.name in {"index.json"}:
                continue
            character_id = char_dir.name
            for kind_dir in char_dir.iterdir():
                if not kind_dir.is_dir():
                    continue
                try:
                    kind = WeightKind.coerce(kind_dir.name)
                except ValueError:
                    continue
                for weight_dir in kind_dir.iterdir():
                    if not weight_dir.is_dir():
                        continue
                    manifest = weight_dir / "manifest.json"
                    data: dict[str, Any] = {}
                    if manifest.is_file():
                        try:
                            data = json.loads(manifest.read_text(encoding="utf-8"))
                        except (OSError, json.JSONDecodeError):
                            data = {}
                    weight_id = str(
                        data.get("weight_id") or data.get("lora_id") or weight_dir.name
                    )
                    if weight_id in self._entries:
                        continue
                    uri = data.get("uri") or self._uri_for(
                        character_id, kind, weight_id
                    )
                    entry = WeightEntry(
                        weight_id=weight_id,
                        character_id=str(data.get("character_id") or character_id),
                        kind=kind,
                        uri=str(uri),
                        lora_id=data.get("lora_id") or weight_id,
                        label=data.get("label"),
                        base_model=data.get("base_model"),
                        trigger_word=data.get("trigger_word"),
                        job_id=data.get("job_id"),
                        active=bool(data.get("active", True)),
                        created_at=str(
                            data.get("created_at")
                            or datetime.now(timezone.utc).isoformat()
                        ),
                        meta=dict(data.get("meta") or {}),
                    )
                    self._entries[weight_id] = entry

    def _uri_for(
        self, character_id: str, kind: WeightKind, weight_id: str
    ) -> str:
        bucket = (self.settings.weights_storage_bucket or "").strip()
        if bucket:
            clean = bucket.rstrip("/")
            if "://" not in clean:
                clean = f"s3://{clean}"
            return f"{clean}/weights/{character_id}/{kind.value}/{weight_id}"
        # file:// local fallback
        local = (self.root_dir / character_id / kind.value / weight_id).resolve()
        return f"file://{local}"

    def save(self) -> None:
        with self._lock:
            payload = {
                "version": 1,
                "bucket": self.settings.weights_storage_bucket or None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "entries": [e.to_dict() for e in self._entries.values()],
                "active": self._active,
            }
            tmp = self.index_path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            tmp.replace(self.index_path)

    def reload(self) -> None:
        self._load()

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    def register(
        self,
        *,
        character_id: str,
        kind: WeightKind | str,
        uri: str | None = None,
        weight_id: str | None = None,
        lora_id: str | None = None,
        label: str | None = None,
        base_model: str | None = None,
        trigger_word: str | None = None,
        job_id: str | None = None,
        set_active: bool = True,
        meta: dict[str, Any] | None = None,
    ) -> WeightEntry:
        kind_e = WeightKind.coerce(kind)
        wid = weight_id or lora_id or f"w-{uuid.uuid4().hex[:12]}"
        lid = lora_id or (wid if kind_e == WeightKind.VISUAL_LORA else None)
        resolved_uri = uri or self._uri_for(character_id, kind_e, wid)

        entry = WeightEntry(
            weight_id=wid,
            character_id=character_id,
            kind=kind_e,
            uri=resolved_uri,
            lora_id=lid,
            label=label or f"{character_id}/{kind_e.value}/{wid}",
            base_model=base_model,
            trigger_word=trigger_word,
            job_id=job_id,
            active=True,
            meta=dict(meta or {}),
        )

        with self._lock:
            self._entries[wid] = entry
            # Persist a local manifest so re-scan finds it
            local_dir = self.root_dir / character_id / kind_e.value / wid
            local_dir.mkdir(parents=True, exist_ok=True)
            (local_dir / "manifest.json").write_text(
                json.dumps(entry.to_dict(), indent=2) + "\n", encoding="utf-8"
            )
            if set_active:
                self._active.setdefault(character_id, {})[kind_e.value] = wid
            self.save()

        logger.info(
            "registered weight %s character=%s kind=%s uri=%s",
            wid,
            character_id,
            kind_e.value,
            resolved_uri,
        )
        return entry

    def set_active(
        self,
        character_id: str,
        kind: WeightKind | str,
        weight_id: str,
    ) -> WeightEntry:
        kind_e = WeightKind.coerce(kind)
        with self._lock:
            entry = self._entries.get(weight_id)
            if not entry:
                # try lora_id match
                entry = self._find_by_lora(weight_id)
            if not entry:
                raise KeyError(f"weight not found: {weight_id}")
            if entry.character_id != character_id:
                # allow cross-bind only if same id requested explicitly
                logger.warning(
                    "binding weight %s (char=%s) as active for %s",
                    weight_id,
                    entry.character_id,
                    character_id,
                )
            self._active.setdefault(character_id, {})[kind_e.value] = entry.weight_id
            self.save()
            return entry

    def unregister(self, weight_id: str) -> bool:
        with self._lock:
            entry = self._entries.pop(weight_id, None)
            if not entry:
                return False
            for cid, kinds in list(self._active.items()):
                for k, wid in list(kinds.items()):
                    if wid == weight_id:
                        del kinds[k]
                if not kinds:
                    self._active.pop(cid, None)
            self.save()
            return True

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get(self, weight_id: str) -> WeightEntry | None:
        with self._lock:
            if weight_id in self._entries:
                return self._entries[weight_id]
            return self._find_by_lora(weight_id)

    def _find_by_lora(self, lora_id: str) -> WeightEntry | None:
        for e in self._entries.values():
            if e.lora_id == lora_id or e.weight_id == lora_id:
                return e
        return None

    def list_weights(
        self,
        *,
        character_id: str | None = None,
        kind: WeightKind | str | None = None,
        active_only: bool = False,
    ) -> list[WeightEntry]:
        kind_e = WeightKind.coerce(kind) if kind else None
        with self._lock:
            out: list[WeightEntry] = []
            for e in self._entries.values():
                if character_id and e.character_id != character_id:
                    continue
                if kind_e and e.kind != kind_e:
                    continue
                if active_only and not e.active:
                    continue
                out.append(e)
            out.sort(key=lambda x: x.created_at, reverse=True)
            return out

    def list_characters(self) -> list[str]:
        with self._lock:
            chars = {e.character_id for e in self._entries.values()}
            chars.update(self._active.keys())
            return sorted(chars)

    def resolve(
        self,
        character_id: str,
        *,
        lora_id: str | None = None,
    ) -> CharacterWeights:
        """
        Resolve active (or lora-overridden) weights for inference.

        If `lora_id` is set, that visual LoRA is preferred even if another is
        marked active for the character.
        """
        character_id = (character_id or "default").strip() or "default"
        with self._lock:
            active_map = dict(self._active.get(character_id) or {})

            visual: WeightEntry | None = None
            llm: WeightEntry | None = None
            voice: WeightEntry | None = None
            resolved_lora_id = lora_id

            if lora_id:
                visual = self._find_by_lora(lora_id)
                if visual is None:
                    visual = self._entries.get(lora_id)
                if visual is not None:
                    resolved_lora_id = visual.lora_id or visual.weight_id

            if visual is None:
                wid = active_map.get(WeightKind.VISUAL_LORA.value)
                if wid:
                    visual = self._entries.get(wid)
                if visual is None:
                    # latest visual for character
                    visuals = [
                        e
                        for e in self._entries.values()
                        if e.character_id == character_id
                        and e.kind == WeightKind.VISUAL_LORA
                        and e.active
                    ]
                    visuals.sort(key=lambda x: x.created_at, reverse=True)
                    visual = visuals[0] if visuals else None
                if visual is not None:
                    resolved_lora_id = resolved_lora_id or visual.lora_id or visual.weight_id

            wid = active_map.get(WeightKind.LLM.value)
            if wid:
                llm = self._entries.get(wid)
            if llm is None:
                llms = [
                    e
                    for e in self._entries.values()
                    if e.character_id == character_id
                    and e.kind == WeightKind.LLM
                    and e.active
                ]
                llms.sort(key=lambda x: x.created_at, reverse=True)
                llm = llms[0] if llms else None

            wid = active_map.get(WeightKind.VOICE.value)
            if wid:
                voice = self._entries.get(wid)
            if voice is None:
                voices = [
                    e
                    for e in self._entries.values()
                    if e.character_id == character_id
                    and e.kind == WeightKind.VOICE
                    and e.active
                ]
                voices.sort(key=lambda x: x.created_at, reverse=True)
                voice = voices[0] if voices else None

            return CharacterWeights(
                character_id=character_id,
                lora_id=resolved_lora_id,
                visual_lora=visual,
                llm=llm,
                voice=voice,
            )

    def reindex_from_bucket_layout(
        self, entries: Iterable[dict[str, Any]]
    ) -> int:
        """
        Bulk-ingest weight descriptors (e.g. from an S3 list or training
        completion webhook). Returns count registered.
        """
        count = 0
        for item in entries:
            if not isinstance(item, dict):
                continue
            uri = item.get("uri") or item.get("weights_uri")
            character_id = item.get("character_id")
            kind = item.get("kind") or item.get("training_kind")
            if not uri or not character_id or not kind:
                continue
            self.register(
                character_id=str(character_id),
                kind=kind,
                uri=str(uri),
                weight_id=item.get("weight_id") or item.get("lora_id"),
                lora_id=item.get("lora_id"),
                label=item.get("label"),
                base_model=item.get("base_model"),
                trigger_word=item.get("trigger_word"),
                job_id=item.get("job_id"),
                set_active=bool(item.get("set_active", True)),
                meta=item.get("meta"),
            )
            count += 1
        return count

    def bucket_prefix(self) -> str | None:
        bucket = (self.settings.weights_storage_bucket or "").strip()
        if not bucket:
            return None
        clean = bucket.rstrip("/")
        if "://" not in clean:
            clean = f"s3://{clean}"
        return f"{clean}/weights"

    def summary(self) -> dict[str, Any]:
        with self._lock:
            by_kind: dict[str, int] = {}
            for e in self._entries.values():
                by_kind[e.kind.value] = by_kind.get(e.kind.value, 0) + 1
            return {
                "bucket": self.settings.weights_storage_bucket or None,
                "bucket_prefix": self.bucket_prefix(),
                "entry_count": len(self._entries),
                "characters": self.list_characters(),
                "by_kind": by_kind,
                "active": dict(self._active),
                "index_path": str(self.index_path),
            }


# ---------------------------------------------------------------------------
# Process-wide singleton
# ---------------------------------------------------------------------------

_registry: WeightRegistry | None = None
_registry_lock = threading.Lock()


def get_weight_registry(
    settings: Settings | None = None,
    *,
    force_new: bool = False,
    root_dir: str | Path | None = None,
) -> WeightRegistry:
    global _registry
    with _registry_lock:
        if force_new or _registry is None or root_dir is not None:
            _registry = WeightRegistry(settings or get_settings(), root_dir=root_dir)
        elif settings is not None:
            _registry.settings = settings
        return _registry


def reset_weight_registry() -> None:
    global _registry
    with _registry_lock:
        _registry = None


def slug_id(value: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-").lower()
    return s or "default"
