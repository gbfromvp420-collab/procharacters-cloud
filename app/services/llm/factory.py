"""Factory that selects mock vs RunPod LLM from settings."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import Settings, get_settings
from app.services.llm.base import LLMProvider
from app.services.llm.mock import MockLLMProvider
from app.services.llm.runpod_llm import RunPodLLMProvider

logger = logging.getLogger(__name__)

_cached: LLMProvider | None = None
_cached_key: tuple[Any, ...] | None = None


def get_llm_provider(
    settings: Settings | None = None,
    *,
    force_new: bool = False,
) -> LLMProvider:
    """
    Return the configured LLM provider.

    Selection uses LLM_PROVIDER when set, otherwise VIDEO_PROVIDER, so a single
    VIDEO_PROVIDER=runpod toggle can flip both stacks during early bring-up.
    """
    global _cached, _cached_key
    cfg = settings or get_settings()
    provider_name = cfg.resolved_llm_provider()
    key = (
        provider_name,
        cfg.runpod_llm_url,
        cfg.runpod_api_key,
        cfg.runpod_timeout_seconds,
    )
    if not force_new and _cached is not None and _cached_key == key:
        return _cached

    provider: LLMProvider
    if provider_name == "runpod":
        if not cfg.runpod_llm_url:
            logger.warning("LLM provider=runpod but RUNPOD_LLM_URL empty; using mock LLM")
            provider = MockLLMProvider()
        else:
            provider = RunPodLLMProvider(cfg)
            logger.info("LLM provider: runpod (%s)", cfg.runpod_llm_url)
    else:
        provider = MockLLMProvider()
        logger.info("LLM provider: mock")

    _cached = provider
    _cached_key = key
    return provider


def reset_llm_provider_cache() -> None:
    global _cached, _cached_key
    _cached = None
    _cached_key = None
