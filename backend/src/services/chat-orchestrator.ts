import {
  LivePromptInjector,
  blendAvatarFromBrain,
  buildConsistencyReminder,
  detectMissingTraits,
  getLiveCharacterProfile,
} from "../lib/live/index.js";
import type { LlmMessage } from "../lib/live/types.js";
import { parseGrokReply } from "../lib/llm/response-parser.js";
import { XaiApiError, XaiChatClient } from "../lib/llm/xai-client.js";
import {
  buildSessionModeInstructions,
  computeModeState,
  formatModeForUi,
  type ModeRuntimeState,
} from "../lib/live/session-mode.js";
import { saveCrossSessionNotes } from "../lib/memory/cross-session-notes.js";
import { buildSessionNotes } from "../lib/memory/session-notes.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import { bump } from "../lib/observability/metrics.js";
import type { AvatarState } from "../types/session.js";
import { MemoryManager } from "./memory-manager.js";
import { SessionManager } from "./session-manager.js";

export interface ChatTurnResult {
  messageId: string;
  content: string;
  avatarIntent: AvatarState;
  promptHash: string;
  consistencyDrift?: string[];
  usedLlm: boolean;
  /** Compact memory blurb for UI. */
  sessionNotes?: string;
  /** Phase 10 mode timer snapshot for UI. */
  modeState?: ReturnType<typeof formatModeForUi>;
}

export interface ChatOrchestratorConfig {
  maxMessageWindow: number;
  xaiApiKey?: string;
  xaiModel: string;
  xaiBaseUrl?: string;
  xaiMaxCompletionTokens?: number;
  xaiTemperature?: number;
}

const injector = new LivePromptInjector();

/**
 * Treat obvious .env.example placeholders as "no key configured" so the stub
 * reply path runs instead of hitting xAI with a fake Bearer token. Real keys
 * are non-empty, don't contain spaces, and don't match the placeholder sentinels
 * shipped in backend/.env.example.
 */
function isRealXaiKey(key: string | undefined): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 16) return false;
  if (/\s/.test(trimmed)) return false;
  const placeholders = new Set([
    "your_xai_api_key_here",
    "your_api_key",
    "changeme",
    "placeholder",
  ]);
  return !placeholders.has(trimmed.toLowerCase());
}

export class ChatOrchestrator {
  private readonly xai: XaiChatClient | null;

  constructor(
    private readonly sessions: SessionManager,
    /** Kept for DI compatibility; avatar defaults now live in blendAvatarFromBrain. */
    _avatarMemory: MemoryManager,
    private readonly config: ChatOrchestratorConfig,
  ) {
    this.xai = isRealXaiKey(config.xaiApiKey)
      ? new XaiChatClient({
          apiKey: config.xaiApiKey!,
          model: config.xaiModel,
          baseUrl: config.xaiBaseUrl,
          maxCompletionTokens: config.xaiMaxCompletionTokens,
          temperature: config.xaiTemperature,
        })
      : null;
  }

  get llmConfigured(): boolean {
    return this.xai !== null;
  }

  async handleUserMessage(sessionId: string, content: string): Promise<ChatTurnResult> {
    const session = this.sessions.getSession(sessionId);
    const memory = SessionMemory.fromData(session.memory, this.config.maxMessageWindow);

    const modeState = computeModeState(
      session.sessionMode ?? "normal",
      session.modeStartedAt ?? session.createdAt,
    );
    const sessionModeBlock = buildSessionModeInstructions(modeState);

    const injection = injector.injectTurn(session.promptSnapshot, {
      context: memory.getRecentContext(),
      pendingUserMessage: content,
      sessionModeBlock,
    });

    let assistantContent: string;
    let parsedAvatar: Partial<AvatarState> | undefined;
    let usedLlm = false;

    if (this.xai) {
      try {
        const raw = await this.callGrokWithConsistencyRetry(
          injection.messages,
          injection.consistencyTraits,
          session.characterId,
          () =>
            injector.injectTurn(session.promptSnapshot, {
              context: memory.getRecentContext(),
              pendingUserMessage: content,
              sessionModeBlock,
            }).messages,
        );
        const parsed = parseGrokReply(raw);
        assistantContent = parsed.text;
        parsedAvatar = parsed.avatarIntent;
        usedLlm = true;
      } catch (error) {
        bump("chatLlmErrors");
        assistantContent = this.buildErrorReply(error);
      }
    } else {
      assistantContent = this.buildStubReply(session.characterId, content, injection.hash);
    }

    bump("chatTurns");
    memory.addTurn(content, assistantContent);

    const notes = buildSessionNotes(memory.getRecentContext().messages, {
      characterName: session.promptSnapshot.characterName,
    });
    memory.setSessionNotes(notes);

    // Opt-in cross-session: refresh stored notes for this account+character
    if (session.accountId) {
      void saveCrossSessionNotes(session.accountId, session.characterId, notes, {
        messageCountHint: memory.getRecentContext().messageCount,
      });
    }

    const avatarIntent = this.buildAvatarState(
      session.characterId,
      session.promptSnapshot.signatureClothing,
      session.avatarState,
      parsedAvatar,
    );

    this.sessions.updateSession(sessionId, {
      memory: memory.toData(),
      avatarState: avatarIntent,
    });

    const lastMessage = memory.getRecentContext().messages.at(-1);

    return {
      messageId: lastMessage?.id ?? "",
      content: assistantContent,
      avatarIntent,
      promptHash: injection.hash,
      usedLlm,
      sessionNotes: notes,
      modeState: formatModeForUi(modeState),
    };
  }

  /** Current mode timer for UI (no chat turn). */
  getModeState(sessionId: string): ModeRuntimeState {
    const session = this.sessions.getSession(sessionId);
    return computeModeState(
      session.sessionMode ?? "normal",
      session.modeStartedAt ?? session.createdAt,
    );
  }

  /**
   * Calls Grok with the full injected prompt (v1.3.0 character + memory block).
   * Retries once if consistency traits appear missing from the reply.
   */
  private async callGrokWithConsistencyRetry(
    messages: LlmMessage[],
    consistencyTraits: string[],
    characterId: string,
    rebuildMessages: () => LlmMessage[],
  ): Promise<string> {
    if (!this.xai) {
      throw new XaiApiError("Grok not configured", 503, "not_configured");
    }

    let raw = await this.xai.complete(messages);
    const drift = detectMissingTraits(parseGrokReply(raw).text, consistencyTraits);
    const profile = getLiveCharacterProfile(characterId);

    if (drift.length > 0 && profile) {
      const reminder = buildConsistencyReminder(profile, drift);
      if (reminder) {
        const retryMessages = rebuildMessages();
        const systemIdx = retryMessages.findIndex((m) => m.role === "system");
        if (systemIdx >= 0) {
          retryMessages[systemIdx] = {
            ...retryMessages[systemIdx],
            content: `${retryMessages[systemIdx].content}\n\n[${reminder}]`,
          };
        }
        raw = await this.xai.complete(retryMessages);
      }
    }

    return raw;
  }

  private buildAvatarState(
    characterId: string,
    signatureClothing: string,
    previous: AvatarState,
    fromGrok?: Partial<AvatarState>,
  ): AvatarState {
    // Brain (Grok + presence) drives body; clips only follow energy.
    return blendAvatarFromBrain(characterId, signatureClothing, previous, fromGrok);
  }

  private buildErrorReply(error: unknown): string {
    if (error instanceof XaiApiError) {
      console.error(
        `[grok] xAI request failed — status=${error.status} code=${error.code ?? "n/a"} message=${error.message}`,
      );

      const msg = error.message.toLowerCase();
      if (
        error.status === 403 &&
        (msg.includes("credit") || msg.includes("spending limit") || msg.includes("monthly"))
      ) {
        return "*[System: xAI credits / spending limit hit — top up or raise limit at console.x.ai]*";
      }
      if (error.status === 401 || error.status === 403) {
        return "*[System: API key issue — check XAI_API_KEY in backend .env]*";
      }
      if (error.status === 429) {
        return "*Mmm, give me just a second… things got a little busy. Try again.*";
      }
      if (error.code === "timeout") {
        return "*Hold on… I got distracted. Say that again for me?*";
      }
    }

    console.error("[grok] unexpected error", error);
    return "*Something glitched on my end. Try sending that again.*";
  }

  private buildStubReply(characterId: string, userContent: string, promptHash: string): string {
    const pronoun = characterId === "female-default" ? "she" : "he";
    return [
      `*[${characterId} v1.3.0 — set XAI_API_KEY in .env]*`,
      `Mmm, I hear you... "${userContent.slice(0, 80)}".`,
      `Stay with me — ${pronoun}'s keeping that slow, teasing energy going just for you.`,
      `(prompt hash: ${promptHash})`,
    ].join(" ");
  }
}