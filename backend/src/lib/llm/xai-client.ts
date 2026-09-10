import type { LlmMessage } from "../live/types.js";

const DEFAULT_BASE_URL = "https://api.x.ai/v1";

export interface XaiClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxCompletionTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface XaiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
    finish_reason?: string | null;
  }>;
  /** xAI may return `error` as a string or as `{ message }`. */
  error?: string | { message?: string; code?: string };
  code?: string;
}

/** One `data:` frame from the SSE stream. */
interface XaiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      refusal?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: string | { message?: string; code?: string };
}

export class XaiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "XaiApiError";
  }
}

/**
 * Minimal xAI / Grok chat client (OpenAI-compatible /v1/chat/completions).
 */
export class XaiChatClient {
  private readonly baseUrl: string;
  private readonly maxCompletionTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: XaiClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxCompletionTokens = config.maxCompletionTokens ?? 1024;
    this.temperature = config.temperature ?? 0.85;
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  /**
   * Same contract as `complete`, but consumes the SSE stream and hands each
   * token delta to `onDelta` as it lands. Returns the assembled reply so
   * callers that need the whole text (avatar_intent parsing, consistency
   * checks, memory) are unaffected.
   *
   * The timeout is applied to time-between-chunks rather than total duration:
   * a long reply that is actively streaming is healthy, a silent socket is not.
   */
  async completeStream(messages: LlmMessage[], onDelta: (delta: string) => void): Promise<string> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const armTimeout = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    };
    armTimeout();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.temperature,
          max_completion_tokens: this.maxCompletionTokens,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // Error responses come back as ordinary JSON even when we asked for SSE.
        const body = (await response.json().catch(() => ({}))) as XaiChatCompletionResponse;
        const raw = body.error;
        const message =
          typeof raw === "string"
            ? raw
            : (raw?.message ?? `xAI request failed (${response.status})`);
        const code = typeof raw === "object" ? raw?.code : body.code;
        throw new XaiApiError(message, response.status, code);
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let refusal = "";

      for await (const bytes of response.body as unknown as AsyncIterable<Uint8Array>) {
        armTimeout();
        buffer += decoder.decode(bytes, { stream: true });

        // SSE events are separated by a blank line; keep any partial tail.
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let chunk: XaiStreamChunk;
            try {
              chunk = JSON.parse(payload) as XaiStreamChunk;
            } catch {
              continue;
            }

            if (chunk.error) {
              const message =
                typeof chunk.error === "string"
                  ? chunk.error
                  : (chunk.error.message ?? "xAI stream error");
              const code = typeof chunk.error === "object" ? chunk.error.code : undefined;
              throw new XaiApiError(message, 502, code ?? "stream_error");
            }

            const delta = chunk.choices?.[0]?.delta;
            if (delta?.refusal) refusal += delta.refusal;
            const piece = delta?.content;
            if (piece) {
              text += piece;
              onDelta(piece);
            }
          }
        }
      }

      if (refusal.trim()) {
        throw new XaiApiError(`Model refused: ${refusal.trim()}`, 422, "refusal");
      }
      if (!text.trim()) {
        throw new XaiApiError("Empty response from Grok", 502, "empty_response");
      }

      return text;
    } catch (error) {
      if (error instanceof XaiApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new XaiApiError("Grok stream stalled", 504, "timeout");
      }
      throw new XaiApiError(
        error instanceof Error ? error.message : "Unknown Grok error",
        500,
        "network",
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async complete(messages: LlmMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.temperature,
          max_completion_tokens: this.maxCompletionTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      const body = (await response.json()) as XaiChatCompletionResponse;

      if (!response.ok) {
        const raw = body.error;
        const message =
          typeof raw === "string"
            ? raw
            : raw?.message ?? `xAI request failed (${response.status})`;
        const code = typeof raw === "object" ? raw?.code : body.code;
        throw new XaiApiError(message, response.status, code);
      }

      const choice = body.choices?.[0];
      const content = choice?.message?.content?.trim();
      const refusal = choice?.message?.refusal?.trim();

      if (refusal) {
        throw new XaiApiError(`Model refused: ${refusal}`, 422, "refusal");
      }

      if (!content) {
        throw new XaiApiError("Empty response from Grok", 502, "empty_response");
      }

      return content;
    } catch (error) {
      if (error instanceof XaiApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new XaiApiError("Grok request timed out", 504, "timeout");
      }
      throw new XaiApiError(
        error instanceof Error ? error.message : "Unknown Grok error",
        500,
        "network",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}