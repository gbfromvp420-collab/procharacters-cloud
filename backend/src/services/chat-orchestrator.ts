import {
  LivePromptInjector,
  buildConsistencyReminder,
  detectMissingTraits,
  getLiveCharacterProfile,
} from "../lib/live/index.js";
import type { LlmMessage } from "../lib/live/types.js";
import { parseGrokReply } from "../lib/llm/response-parser.js";
import { XaiApiError, XaiChatClient } from "../lib/llm/xai-client.js";
import { maybeGenerateImage } from "../lib/media/image-gen-hook.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import type { AvatarState } from "../types/session.js";
import type { MediaGenerationService } from "./media-generation-service.js";
import { MemoryManager } from "./memory-manager.js";
import { SessionManager } from "./session-manager.js";

export interface ChatTurnResult {
  messageId: string;
  content: string;
  avatarIntent: AvatarState;
  promptHash: string;
  consistencyDrift?: string[];
  usedLlm: boolean;
  generatedImageUrl?: string;
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

export class ChatOrchestrator {
  private readonly xai: XaiChatClient | null;
  private readonly mediaGen: MediaGenerationService | null;

  constructor(
    private readonly sessions: SessionManager,
    private readonly avatarMemory: MemoryManager,
    private readonly config: ChatOrchestratorConfig,
    mediaGen?: MediaGenerationService | null,
  ) {
    this.xai = config.xaiApiKey
      ? new XaiChatClient({
          apiKey: config.xaiApiKey,
          model: config.xaiModel,
          baseUrl: config.xaiBaseUrl,
          maxCompletionTokens: config.xaiMaxCompletionTokens,
          temperature: config.xaiTemperature,
        })
      : null;
    this.mediaGen = mediaGen ?? null;
  }

  get llmConfigured(): boolean {
    return this.xai !== null;
  }

  async handleUserMessage(sessionId: string, content: string): Promise<ChatTurnResult> {
    const session = this.sessions.getSession(sessionId);
    const memory = SessionMemory.fromData(session.memory, this.config.maxMessageWindow);

    const injection = injector.injectTurn(session.promptSnapshot, {
      context: memory.getRecentContext(),
      pendingUserMessage: content,
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
            }).messages,
        );
        const parsed = parseGrokReply(raw);
        assistantContent = parsed.text;
        parsedAvatar = parsed.avatarIntent;
        usedLlm = true;
      } catch (error) {
        assistantContent = this.buildErrorReply(error);
      }
    } else {
      assistantContent = this.buildStubReply(session.characterId, content, injection.hash);
    }

    memory.addTurn(content, assistantContent);

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

    // Step 6: Image generation hook — fire-and-forget for key intents
    let generatedImageUrl: string | undefined;
    if (this.mediaGen) {
      // Build appearance ref from the appearance anchor text
      const appearanceRef: Record<string, string> = {
        character: session.characterId,
        appearance: session.promptSnapshot.appearanceAnchor ?? "",
      };
      const imgUrl = await maybeGenerateImage(
        sessionId,
        session.characterId,
        assistantContent,
        avatarIntent,
        appearanceRef,
        this.mediaGen,
      );
      if (imgUrl) {
        generatedImageUrl = imgUrl;
      }
    }

    return {
      messageId: lastMessage?.id ?? "",
      content: assistantContent,
      avatarIntent,
      promptHash: injection.hash,
      usedLlm,
      generatedImageUrl,
    };
  }

  /**
   * Calls Grok with the full injected prompt (v1.2.0 character + memory block).
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
    const base = this.avatarMemory.defaultAvatarState(characterId);

    return {
      emotion: fromGrok?.emotion ?? previous.emotion ?? base.emotion,
      pose: fromGrok?.pose ?? previous.pose ?? base.pose,
      action: fromGrok?.action ?? previous.action ?? base.action,
      arousalLevel:
        fromGrok?.arousalLevel ??
        Math.min(previous.arousalLevel + 0.05, 1),
      clothingState: fromGrok?.clothingState ?? signatureClothing ?? base.clothingState,
    };
  }

  private buildErrorReply(error: unknown): string {
    if (error instanceof XaiApiError) {
      console.error(`[grok] ${error.status} ${error.code ?? ""} ${error.message}`);

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
      `*[${characterId} v1.2.0 — set XAI_API_KEY in .env]*`,
      `Mmm, I hear you... "${userContent.slice(0, 80)}".`,
      `Stay with me — ${pronoun}'s keeping that slow, teasing energy going just for you.`,
      `(prompt hash: ${promptHash})`,
    ].join(" ");
  }
}