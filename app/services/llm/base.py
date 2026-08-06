"""LLM provider protocol shared by mock and RunPod implementations."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Protocol, runtime_checkable


@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMRequest:
    session_id: str
    character_id: str
    messages: list[LLMMessage]
    temperature: float = 0.8
    max_tokens: int = 512
    stream: bool = False
    lora_id: str | None = None
    llm_weights_uri: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResult:
    ok: bool
    provider: str
    text: str = ""
    model: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@runtime_checkable
class LLMProvider(Protocol):
    name: str

    async def complete(self, request: LLMRequest) -> LLMResult:
        """Non-streaming completion."""
        ...

    async def stream(self, request: LLMRequest) -> AsyncIterator[str]:
        """Yield text deltas for streaming completions."""
        ...

    async def aclose(self) -> None:
        ...
