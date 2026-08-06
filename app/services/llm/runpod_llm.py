"""
RunPod LLM provider — async HTTPX client with streaming network support.

Compatible with common RunPod OpenAI-compatible or serverless shapes:
  POST {RUNPOD_LLM_URL}/v1/chat/completions
  POST {RUNPOD_LLM_URL}/runsync
  POST {RUNPOD_LLM_URL}/chat/completions
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from app.core.config import Settings, get_settings
from app.services.llm.base import LLMRequest, LLMResult

logger = logging.getLogger(__name__)


class RunPodLLMProvider:
    name = "runpod"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._owns_client = client is None
        timeout = httpx.Timeout(
            self.settings.runpod_timeout_seconds,
            connect=self.settings.runpod_connect_timeout_seconds,
        )
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            headers=self.settings.runpod_headers(),
            follow_redirects=True,
        )

    @property
    def base_url(self) -> str:
        return (self.settings.runpod_llm_url or "").rstrip("/")

    def _ensure_configured(self) -> None:
        if not self.base_url:
            raise RuntimeError("RUNPOD_LLM_URL is not configured for llm_provider=runpod")

    def _messages_payload(self, request: LLMRequest) -> list[dict[str, str]]:
        return [{"role": m.role, "content": m.content} for m in request.messages]

    def _weight_fields(self, request: LLMRequest) -> dict[str, Any]:
        """Character adapter / LoRA weight refs for the LLM worker."""
        fields: dict[str, Any] = {
            "character_id": request.character_id,
            "session_id": request.session_id,
        }
        if request.lora_id:
            fields["lora_id"] = request.lora_id
        if request.llm_weights_uri:
            fields["llm_weights_uri"] = request.llm_weights_uri
            fields["adapter_uri"] = request.llm_weights_uri
        weights = (request.extra or {}).get("weights")
        if isinstance(weights, dict):
            fields["weights"] = weights
            if not request.llm_weights_uri and weights.get("llm_weights_uri"):
                fields["llm_weights_uri"] = weights["llm_weights_uri"]
                fields["adapter_uri"] = weights["llm_weights_uri"]
        return fields

    def _model_name(self, request: LLMRequest) -> str:
        if request.extra.get("model"):
            return str(request.extra["model"])
        weights = request.extra.get("weights") if request.extra else None
        if isinstance(weights, dict) and weights.get("llm_base_model"):
            return str(weights["llm_base_model"])
        if isinstance(weights, dict) and weights.get("model"):
            return str(weights["model"])
        return "default"

    async def complete(self, request: LLMRequest) -> LLMResult:
        self._ensure_configured()
        messages = self._messages_payload(request)
        weight_fields = self._weight_fields(request)
        model = self._model_name(request)
        extra = dict(request.extra or {})
        extra.pop("weights", None)
        extra.pop("model", None)

        # OpenAI-compatible payloads carry adapter refs in a nested `extra` /
        # top-level weight fields; serverless /runsync uses input bundle.
        openai_body = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": False,
            **{k: v for k, v in weight_fields.items() if k not in {"session_id"}},
            "extra_body": {
                **weight_fields,
                **extra,
            },
        }

        # Try OpenAI-compatible path first, then RunPod serverless /runsync.
        attempts = [
            (f"{self.base_url}/v1/chat/completions", openai_body),
            (f"{self.base_url}/chat/completions", openai_body),
            (f"{self.base_url}/runsync", {
                "input": {
                    "messages": messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                    "model": model,
                    **weight_fields,
                    **extra,
                }
            }),
        ]

        last_error: str | None = None
        for url, payload in attempts:
            try:
                response = await self._client.post(url, json=payload)
                if response.status_code == 404:
                    last_error = f"404 {url}"
                    continue
                response.raise_for_status()
                data = _safe_json(response)
                text = _extract_text(data)
                return LLMResult(
                    ok=bool(text),
                    provider=self.name,
                    text=text or "",
                    model=_extract_model(data) or model,
                    usage=_extract_usage(data),
                    meta={
                        "url": url,
                        "raw_keys": list(data.keys()),
                        "character_id": request.character_id,
                        "lora_id": request.lora_id,
                        "llm_weights_uri": request.llm_weights_uri,
                    },
                    error=None if text else "empty_completion",
                )
            except httpx.TimeoutException as exc:
                logger.warning("RunPod LLM timeout on %s: %s", url, exc)
                return LLMResult(
                    ok=False,
                    provider=self.name,
                    error=f"timeout: {exc}",
                    meta={"url": url},
                )
            except httpx.HTTPError as exc:
                last_error = f"http_error: {exc}"
                logger.warning("RunPod LLM HTTP error on %s: %s", url, exc)
                continue

        return LLMResult(
            ok=False,
            provider=self.name,
            error=last_error or "all_endpoints_failed",
        )

    async def stream(self, request: LLMRequest) -> AsyncIterator[str]:
        """
        Stream SSE / NDJSON token deltas from an OpenAI-compatible RunPod endpoint.
        Falls back to chunking a full completion on failure.
        """
        self._ensure_configured()
        messages = self._messages_payload(request)
        url = f"{self.base_url}/v1/chat/completions"
        weight_fields = self._weight_fields(request)
        payload = {
            "model": self._model_name(request),
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True,
            **{k: v for k, v in weight_fields.items() if k not in {"session_id"}},
            "extra_body": weight_fields,
        }

        try:
            async with self._client.stream(
                "POST",
                url,
                json=payload,
                headers={**self.settings.runpod_headers(), "Accept": "text/event-stream"},
            ) as response:
                if response.status_code >= 400:
                    # Fall back to non-streaming
                    result = await self.complete(request)
                    if result.text:
                        yield result.text
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        delta = _extract_stream_delta(chunk)
                        if delta:
                            yield delta
        except httpx.TimeoutException as exc:
            logger.warning("RunPod LLM stream timeout: %s", exc)
            return
        except httpx.HTTPError as exc:
            logger.warning("RunPod LLM stream error: %s; falling back to complete()", exc)
            result = await self.complete(request)
            if result.text:
                yield result.text

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
        return data if isinstance(data, dict) else {"output": data}
    except Exception:
        return {"raw": response.text}


def _extract_text(data: dict[str, Any]) -> str:
    # OpenAI chat.completions
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(msg, dict) and msg.get("content"):
            return str(msg["content"])
        if isinstance(choices[0], dict) and choices[0].get("text"):
            return str(choices[0]["text"])

    # RunPod serverless output
    output = data.get("output")
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        for key in ("text", "response", "content", "message"):
            if output.get(key):
                return str(output[key])
        if isinstance(output.get("choices"), list) and output["choices"]:
            return _extract_text(output)

    for key in ("text", "response", "content"):
        if data.get(key):
            return str(data[key])
    return ""


def _extract_model(data: dict[str, Any]) -> str | None:
    if data.get("model"):
        return str(data["model"])
    output = data.get("output")
    if isinstance(output, dict) and output.get("model"):
        return str(output["model"])
    return None


def _extract_usage(data: dict[str, Any]) -> dict[str, Any]:
    usage = data.get("usage")
    return usage if isinstance(usage, dict) else {}


def _extract_stream_delta(chunk: dict[str, Any]) -> str:
    choices = chunk.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    choice = choices[0] if isinstance(choices[0], dict) else {}
    delta = choice.get("delta") if isinstance(choice, dict) else None
    if isinstance(delta, dict) and delta.get("content"):
        return str(delta["content"])
    if isinstance(choice, dict) and choice.get("text"):
        return str(choice["text"])
    return ""
