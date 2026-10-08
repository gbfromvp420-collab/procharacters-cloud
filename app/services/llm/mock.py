"""In-process mock LLM for local dev and smoke tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.services.llm.base import LLMRequest, LLMResult


class MockLLMProvider:
    name = "mock"

    def __init__(self, *, delay_ms: int = 5) -> None:
        self.delay_ms = delay_ms

    async def complete(self, request: LLMRequest) -> LLMResult:
        await asyncio.sleep(self.delay_ms / 1000.0)
        last_user = ""
        for m in reversed(request.messages):
            if m.role == "user":
                last_user = m.content
                break
        text = f"[{request.character_id}] Acknowledged: {last_user[:200]}"
        return LLMResult(
            ok=True,
            provider=self.name,
            text=text,
            model="mock-llm",
            usage={"prompt_tokens": 0, "completion_tokens": len(text.split())},
            meta={
                "session_id": request.session_id,
                "lora_id": request.lora_id,
                "llm_weights_uri": request.llm_weights_uri,
            },
        )

    async def stream(self, request: LLMRequest) -> AsyncIterator[str]:
        result = await self.complete(request)
        # Yield word-ish chunks
        words = result.text.split(" ")
        for i, w in enumerate(words):
            chunk = w if i == 0 else f" {w}"
            yield chunk
            await asyncio.sleep(self.delay_ms / 1000.0)

    async def aclose(self) -> None:
        return None
