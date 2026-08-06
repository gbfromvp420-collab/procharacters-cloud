"""Factory that selects mock vs RunPod MuseTalk from settings."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings, get_settings
from app.services.video.base import VideoProvider
from app.services.video.mock import MockVideoProvider
from app.services.video.musetalk_runpod import MuseTalkRunPodProvider

logger = logging.getLogger(__name__)

_cached: VideoProvider | None = None
_cached_key: tuple[Any, ...] | None = None


def get_video_provider(
    settings: Settings | None = None,
    *,
    force_new: bool = False,
) -> VideoProvider:
    """
    Return the configured video provider.

    Does not change call-site contracts used by media_bridge — only the
    concrete implementation switches with VIDEO_PROVIDER.
    """
    global _cached, _cached_key
    cfg = settings or get_settings()
    key = (
        cfg.video_provider,
        cfg.runpod_musetalk_url,
        cfg.runpod_api_key,
        cfg.runpod_timeout_seconds,
    )
    if not force_new and _cached is not None and _cached_key == key:
        return _cached

    provider: VideoProvider
    if cfg.video_provider == "runpod":
        if not cfg.runpod_musetalk_url:
            logger.warning(
                "VIDEO_PROVIDER=runpod but RUNPOD_MUSETALK_URL empty; "
                "using mock video provider"
            )
            provider = MockVideoProvider()
        else:
            provider = MuseTalkRunPodProvider(cfg)
            logger.info("Video provider: runpod MuseTalk (%s)", cfg.runpod_musetalk_url)
    else:
        provider = MockVideoProvider()
        logger.info("Video provider: mock")

    _cached = provider
    _cached_key = key
    return provider


def reset_video_provider_cache() -> None:
    """Drop cached provider (for tests / env reloads)."""
    global _cached, _cached_key
    _cached = None
    _cached_key = None
