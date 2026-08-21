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
            : (raw?.message ?? `xAI request failed (${response.status})`);
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
