import { randomUUID } from "node:crypto";
import {
  getResumeCodeForSession,
  pruneExpiredResumeCodes,
  registerResumeCode,
  resolveResumeCode,
  rotateResumeCode,
} from "../lib/accounts/account-store.js";
import { DEFAULT_PROMPT_VERSION } from "../config/constants.js";
import { assertLiveCharacter } from "../lib/live/character-catalog.js";
import { createPromptSnapshot } from "../lib/live/prompt-snapshot.js";
import { SessionMemory } from "../lib/memory/session-memory.js";
import {
  buildAccountSessionsExport,
  buildSessionExport,
  isBulkAccountExport,
  parseImportDocument,
  parseImportDocumentAll,
  type AccountSessionsExport,
  type ImportSessionPayload,
  type SessionExport,
} from "../lib/memory/session-export.js";
import {
  getLiveCharacterProfile,
  LiveCharacterError,
} from "../lib/live/character-catalog.js";
import {
  deleteSessionRecord,
  listSessionRecords,
  loadSessionRecord,
  saveSessionRecord,
} from "../lib/memory/session-store.js";
import { clearAccountResumeCodes } from "../lib/accounts/account-store.js";
import type {
  CreateSessionInput,
  CreateSessionResult,
  SessionRecord,
} from "../types/session.js";
import { MemoryManager } from "./memory-manager.js";

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionAuthError";
  }
}

export class SessionImportError extends Error {
  constructor(
    message: string,
    public readonly code: string = "IMPORT_FAILED",
  ) {
    super(message);
    this.name = "SessionImportError";
  }
}

type SessionImportResult = CreateSessionResult & {
  messages: SessionRecord["memory"]["messages"];
  imported: {
    messageCount: number;
    originalSessionId?: string;
    originalCharacterId: string;
    characterId: string;
    /** Set when original character was missing and remapped. */
    remappedFrom?: string;
    truncated?: boolean;
    dropped?: number;
    bulkIndex?: number;
    bulkTotal?: number;
  };
};

type BulkImportItemOk = {
  ok: true;
  index: number;
  sessionId: string;
  characterId: string;
  characterName: string;
  messageCount: number;
  resumeCode?: string;
  remappedFrom?: string;
};

export type ImportCharacterResolveOptions = {
  /** Force every session onto this character (legacy single override). */
  characterId?: string;
  /**
   * Map export characterId → live characterId for missing customs.
   * e.g. { "custom-abc": "twink-default" }
   */
  characterMap?: Record<string, string>;
  /**
   * When original is missing and not in map, use this live id.
   * e.g. "twink-default"
   */
  fallbackCharacterId?: string;
};

/**
 * Resolve which live character to use for an imported transcript.
 * Order: global override → map → original if live → fallback → error.
 */
export function resolveImportCharacterId(
  sourceCharacterId: string,
  options: ImportCharacterResolveOptions = {},
): { characterId: string; remappedFrom?: string } {
  const source = sourceCharacterId.trim();
  if (!source) {
    throw new SessionImportError("Missing characterId in export", "CHARACTER_MISSING");
  }

  const global = options.characterId?.trim();
  if (global) {
    if (!getLiveCharacterProfile(global)) {
      throw new SessionImportError(
        `Override character '${global}' is not available`,
        "CHARACTER_MISSING",
      );
    }
    return global === source
      ? { characterId: global }
      : { characterId: global, remappedFrom: source };
  }

  const mapped = options.characterMap?.[source]?.trim();
  if (mapped) {
    if (!getLiveCharacterProfile(mapped)) {
      throw new SessionImportError(
        `Mapped character '${mapped}' (from '${source}') is not available`,
        "CHARACTER_MISSING",
      );
    }
    return mapped === source
      ? { characterId: mapped }
      : { characterId: mapped, remappedFrom: source };
  }

  if (getLiveCharacterProfile(source)) {
    return { characterId: source };
  }

  const fallback = options.fallbackCharacterId?.trim();
  if (fallback) {
    if (!getLiveCharacterProfile(fallback)) {
      throw new SessionImportError(
        `Fallback character '${fallback}' is not available`,
        "CHARACTER_MISSING",
      );
    }
    return { characterId: fallback, remappedFrom: source };
  }

  throw new SessionImportError(
    `Character '${source}' is not available to restore. Map it with characterMap or set fallbackCharacterId (e.g. twink-default).`,
    "CHARACTER_MISSING",
  );
}

export type ImportPreviewSession = {
  index: number;
  ok: boolean;
  characterName: string;
  originalCharacterId: string;
  characterId?: string;
  remappedFrom?: string;
  messageCount: number;
  truncated?: boolean;
  dropped?: number;
  error?: string;
  code?: string;
};

export type ImportPreviewCharacter = {
  id: string;
  name: string;
  sessionCount: number;
  available: boolean;
  resolvedTo?: string;
  remapped: boolean;
  error?: string;
};

export type ImportPreview = {
  dryRun: true;
  sourceSchema: string;
  bulkTotal: number;
  entriesParsed: number;
  capped: boolean;
  willSucceed: number;
  willFail: number;
  totalMessages: number;
  sessions: ImportPreviewSession[];
  characters: ImportPreviewCharacter[];
};

type BulkImportItemFail = {
  ok: false;
  index: number;
  characterId?: string;
  characterName?: string;
  error: string;
  code?: string;
};

export type BulkImportSummary = {
  total: number;
  succeeded: number;
  failed: number;
  capped: boolean;
  totalMessages: number;
  results: Array<BulkImportItemOk | BulkImportItemFail>;
};

export class SessionManager {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly memory: MemoryManager,
    private readonly defaultCharacterId: string,
    private readonly sessionTtlMinutes: number,
    private readonly maxMessageWindow: number,
  ) {}

  async createSession(
    input: CreateSessionInput = {},
    wsBaseUrl: string,
  ): Promise<CreateSessionResult> {
    const characterId = input.characterId ?? this.defaultCharacterId;
    const promptVersion = input.promptVersion ?? DEFAULT_PROMPT_VERSION;

    assertLiveCharacter(characterId);
    const promptSnapshot = await createPromptSnapshot(characterId, promptVersion);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMinutes * 60_000);
    const sessionId = randomUUID();
    const wsToken = randomUUID();
    const resumeCode = await registerResumeCode(sessionId, input.accountId);

    const record: SessionRecord = {
      id: sessionId,
      characterId: promptSnapshot.characterId,
      promptVersion: promptSnapshot.promptVersion,
      promptSnapshot,
      wsToken,
      status: "active",
      memory: SessionMemory.empty(this.maxMessageWindow).toData(),
      avatarState: this.memory.defaultAvatarState(promptSnapshot.characterId),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      resumeCode,
      ...(input.accountId ? { accountId: input.accountId } : {}),
    };

    this.sessions.set(sessionId, record);
    await this.persist(record);

    return this.toCreateResult(record, wsBaseUrl);
  }

  /**
   * Resume a previous chat: keep transcript + character, mint a new ws token,
   * reactivate, and extend TTL. Works for ended sessions that still have memory.
   */
  async resumeSession(
    sessionId: string,
    token: string,
    wsBaseUrl: string,
  ): Promise<CreateSessionResult & { messages: SessionRecord["memory"]["messages"] }> {
    const session = await this.loadSession(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    return this.reactivate(session, wsBaseUrl);
  }

  /** Resume via short code (no raw ws token in the share URL). */
  async resumeByCode(
    code: string,
    wsBaseUrl: string,
  ): Promise<CreateSessionResult & { messages: SessionRecord["memory"]["messages"] }> {
    const mapping = await resolveResumeCode(code);
    if (!mapping) {
      throw new SessionNotFoundError("resume-code");
    }
    const session = await this.loadSession(mapping.sessionId);
    return this.reactivate(session, wsBaseUrl);
  }

  /** Resume a session owned by a logged-in account (no ws token needed). */
  async resumeForAccount(
    accountId: string,
    sessionId: string,
    wsBaseUrl: string,
  ): Promise<CreateSessionResult & { messages: SessionRecord["memory"]["messages"] }> {
    const session = await this.loadSession(sessionId);
    if (session.accountId !== accountId) {
      throw new SessionAuthError("Session does not belong to this account");
    }
    return this.reactivate(session, wsBaseUrl);
  }

  async claimSessionForAccount(sessionId: string, accountId: string): Promise<SessionRecord> {
    const session = await this.loadSession(sessionId);
    const updated: SessionRecord = {
      ...session,
      accountId,
      updatedAt: new Date().toISOString(),
    };
    if (!updated.resumeCode) {
      updated.resumeCode = await registerResumeCode(sessionId, accountId);
    } else {
      await registerResumeCode(sessionId, accountId, updated.resumeCode);
    }
    this.sessions.set(sessionId, updated);
    await this.persist(updated);
    return updated;
  }

  async listAccountSessions(accountId: string): Promise<
    Array<{
      sessionId: string;
      characterId: string;
      characterName: string;
      status: SessionRecord["status"];
      messageCount: number;
      resumeCode?: string;
      resumeExpiresAt?: string;
      updatedAt: string;
      createdAt: string;
    }>
  > {
    await pruneExpiredResumeCodes();
    const records = await listSessionRecords({ accountId, limit: 40 });
    const out: Array<{
      sessionId: string;
      characterId: string;
      characterName: string;
      status: SessionRecord["status"];
      messageCount: number;
      resumeCode?: string;
      resumeExpiresAt?: string;
      updatedAt: string;
      createdAt: string;
    }> = [];

    // Ensure every account-owned session has a non-expired resume code.
    for (const record of records) {
      let resumeCode = record.resumeCode;
      const existing = await getResumeCodeForSession(record.id);
      // Missing map entry or expired → mint a *new* public code (old links stay dead)
      const needsNewCode = !existing;

      if (needsNewCode) {
        resumeCode = await registerResumeCode(record.id, accountId, undefined, {
          forceNew: true,
        });
        const mapping = await getResumeCodeForSession(record.id);
        const updated: SessionRecord = {
          ...record,
          resumeCode,
          accountId,
          updatedAt: new Date().toISOString(),
        };
        this.sessions.set(record.id, updated);
        await this.persist(updated);
        out.push({
          sessionId: updated.id,
          characterId: updated.characterId,
          characterName: updated.promptSnapshot?.characterName ?? updated.characterId,
          status: updated.status,
          messageCount: updated.memory?.messages?.length ?? 0,
          resumeCode,
          resumeExpiresAt: mapping?.expiresAt,
          updatedAt: updated.updatedAt,
          createdAt: updated.createdAt,
        });
      } else {
        // Valid code — re-bind + soft-extend TTL on list (keeps active chats usable)
        resumeCode = await registerResumeCode(record.id, accountId, resumeCode, {
          extendOnly: true,
        });
        const mapping = await getResumeCodeForSession(record.id);
        if (resumeCode !== record.resumeCode) {
          const updated: SessionRecord = { ...record, resumeCode, accountId };
          this.sessions.set(record.id, updated);
          await this.persist(updated);
        } else {
          this.sessions.set(record.id, record);
        }
        out.push({
          sessionId: record.id,
          characterId: record.characterId,
          characterName: record.promptSnapshot?.characterName ?? record.characterId,
          status: record.status,
          messageCount: record.memory?.messages?.length ?? 0,
          resumeCode,
          resumeExpiresAt: mapping?.expiresAt,
          updatedAt: record.updatedAt,
          createdAt: record.createdAt,
        });
      }
    }

    return out;
  }

  /** Force-rotate one session's resume code (invalidates prior share links). */
  async refreshSessionResumeCode(
    accountId: string,
    sessionId: string,
  ): Promise<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }> {
    const session = await this.loadSession(sessionId);
    if (session.accountId !== accountId) {
      throw new SessionAuthError("Session does not belong to this account");
    }
    const { code, expiresAt } = await rotateResumeCode(sessionId, accountId);
    const updated: SessionRecord = {
      ...session,
      resumeCode: code,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    await this.persist(updated);
    return { sessionId, resumeCode: code, resumeExpiresAt: expiresAt };
  }

  /** Rotate resume codes for every account session. */
  async refreshAllAccountResumeCodes(accountId: string): Promise<{
    refreshed: number;
    sessions: Array<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }>;
  }> {
    const records = await listSessionRecords({ accountId, limit: 100 });
    const sessions: Array<{ sessionId: string; resumeCode: string; resumeExpiresAt: string }> =
      [];
    for (const record of records) {
      const { code, expiresAt } = await rotateResumeCode(record.id, accountId);
      const updated: SessionRecord = {
        ...record,
        resumeCode: code,
        accountId,
        updatedAt: new Date().toISOString(),
      };
      this.sessions.set(record.id, updated);
      await this.persist(updated);
      sessions.push({
        sessionId: record.id,
        resumeCode: code,
        resumeExpiresAt: expiresAt,
      });
    }
    return { refreshed: sessions.length, sessions };
  }

  /** Latest account session for a character (with resume code guaranteed when possible). */
  async latestAccountSessionForCharacter(
    accountId: string,
    characterId: string,
  ): Promise<{
    sessionId: string;
    characterId: string;
    characterName: string;
    resumeCode?: string;
    messageCount: number;
    status: SessionRecord["status"];
    updatedAt: string;
  } | null> {
    const list = await this.listAccountSessions(accountId);
    const match = list.find((s) => s.characterId === characterId);
    if (!match) return null;
    return {
      sessionId: match.sessionId,
      characterId: match.characterId,
      characterName: match.characterName,
      resumeCode: match.resumeCode,
      messageCount: match.messageCount,
      status: match.status,
      updatedAt: match.updatedAt,
    };
  }

  getSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(session);
    return session;
  }

  /** Sync get that also hydrates from disk when missing (used by routes). */
  async getSessionAsync(sessionId: string): Promise<SessionRecord> {
    const session = await this.loadSession(sessionId);
    this.assertNotExpired(session);
    return session;
  }

  authenticate(sessionId: string, token: string): SessionRecord {
    // Prefer sync path for WS; hydrate must happen before connect via resume/create.
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    this.assertNotExpired(session);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    if (session.status !== "active") {
      throw new SessionAuthError("Session is not active — resume it first");
    }
    return session;
  }

  /** Async authenticate that can load from disk (HTTP routes / WS). */
  async authenticateAsync(
    sessionId: string,
    token: string,
    options: { requireActive?: boolean } = {},
  ): Promise<SessionRecord> {
    const requireActive = options.requireActive !== false;
    const session = await this.loadSession(sessionId);
    if (session.wsToken !== token) {
      throw new SessionAuthError("Invalid session token");
    }
    this.assertNotExpired(session);
    if (requireActive && session.status !== "active") {
      throw new SessionAuthError("Session is not active — resume it first");
    }
    return session;
  }

  updateSession(sessionId: string, patch: Partial<SessionRecord>): SessionRecord {
    const session = this.getSession(sessionId);
    const updated: SessionRecord = {
      ...session,
      ...patch,
      id: session.id,
      promptSnapshot: patch.promptSnapshot ?? session.promptSnapshot,
      memory: patch.memory ?? session.memory,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    void this.persist(updated);
    return updated;
  }

  endSession(sessionId: string, _reason = "user_ended"): SessionRecord {
    // Ensure session is loaded/active path validated, then soft-end.
    this.getSession(sessionId);
    // Keep transcript for cross-visit resume — do not wipe memory.
    const updated = this.updateSession(sessionId, { status: "ended" });
    void this.persist(updated);
    return updated;
  }

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()];
  }

  async deleteSessionForAccount(accountId: string, sessionId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    if (session.accountId !== accountId) {
      throw new SessionAuthError("Session does not belong to this account");
    }
    this.sessions.delete(sessionId);
    await deleteSessionRecord(sessionId);
    return true;
  }

  async wipeAccountSessions(accountId: string): Promise<number> {
    const records = await listSessionRecords({ accountId, limit: 500 });
    let deleted = 0;
    for (const record of records) {
      this.sessions.delete(record.id);
      await deleteSessionRecord(record.id);
      deleted += 1;
    }
    await clearAccountResumeCodes(accountId);
    return deleted;
  }

  /**
   * Export one session transcript (no wsToken / system prompts).
   * Auth via owning account or current ws token.
   */
  async exportSession(options: {
    sessionId: string;
    accountId?: string;
    token?: string;
  }): Promise<SessionExport> {
    const session = await this.loadSession(options.sessionId);

    if (options.accountId) {
      if (session.accountId !== options.accountId) {
        throw new SessionAuthError("Session does not belong to this account");
      }
    } else if (options.token) {
      if (session.wsToken !== options.token) {
        throw new SessionAuthError("Invalid session token");
      }
    } else {
      throw new SessionAuthError("Account or session token required to export");
    }

    // Ended / soft-expired archives are still exportable.
    return buildSessionExport(session);
  }

  async exportAccountSessions(
    accountId: string,
    handle?: string,
  ): Promise<AccountSessionsExport> {
    const records = await listSessionRecords({ accountId, limit: 100 });
    for (const record of records) {
      this.sessions.set(record.id, record);
    }
    return buildAccountSessionsExport({ accountId, handle, records });
  }

  /**
   * Dry-run import: parse export, resolve remaps, report what would succeed.
   * Does not create sessions, tokens, or resume codes.
   */
  previewImport(
    document: unknown,
    options: {
      sessionIndex?: number;
      importAll?: boolean;
    } & ImportCharacterResolveOptions = {},
  ): ImportPreview {
    const wantAll =
      options.importAll === true ||
      (options.importAll !== false &&
        options.sessionIndex === undefined &&
        isBulkAccountExport(document));

    if (wantAll || isBulkAccountExport(document)) {
      const parsed = parseImportDocumentAll(document);
      if (!parsed.ok) {
        throw new SessionImportError(parsed.error, parsed.code);
      }
      return this.buildImportPreview(parsed, options);
    }

    const parsed = parseImportDocument(document, {
      sessionIndex: options.sessionIndex,
    });
    if (!parsed.ok) {
      throw new SessionImportError(parsed.error, parsed.code);
    }

    // Normalize single to bulk-shaped preview
    return this.buildImportPreview(
      {
        entries: [
          {
            index: parsed.bulkIndex ?? 0,
            session: parsed.session,
            truncated: parsed.truncated === true,
            dropped: parsed.dropped ?? 0,
          },
        ],
        sourceSchema: parsed.sourceSchema,
        bulkTotal: parsed.bulkTotal ?? 1,
        capped: false,
      },
      options,
    );
  }

  private buildImportPreview(
    parsed: {
      entries: Array<{
        index: number;
        session: ImportSessionPayload;
        truncated: boolean;
        dropped: number;
      }>;
      sourceSchema: string;
      bulkTotal: number;
      capped: boolean;
    },
    options: ImportCharacterResolveOptions,
  ): ImportPreview {
    const sessions: ImportPreviewSession[] = [];
    const charAgg = new Map<
      string,
      { name: string; sessionCount: number; available: boolean; resolvedTo?: string; remapped: boolean; error?: string }
    >();

    for (const entry of parsed.entries) {
      const originalCharacterId = entry.session.characterId;
      const characterName = entry.session.characterName;
      const messageCount = entry.session.messages.length;

      let ok = true;
      let characterId: string | undefined;
      let remappedFrom: string | undefined;
      let error: string | undefined;
      let code: string | undefined;

      try {
        const resolved = resolveImportCharacterId(originalCharacterId, options);
        characterId = resolved.characterId;
        remappedFrom = resolved.remappedFrom;
      } catch (err) {
        ok = false;
        error = err instanceof Error ? err.message : "Resolve failed";
        code = err instanceof SessionImportError ? err.code : "CHARACTER_MISSING";
      }

      sessions.push({
        index: entry.index,
        ok,
        characterName,
        originalCharacterId,
        characterId,
        remappedFrom,
        messageCount,
        truncated: entry.truncated,
        dropped: entry.dropped,
        error,
        code,
      });

      const existing = charAgg.get(originalCharacterId);
      if (existing) {
        existing.sessionCount += 1;
        if (!ok && !existing.error) existing.error = error;
      } else {
        charAgg.set(originalCharacterId, {
          name: characterName,
          sessionCount: 1,
          available: ok && !remappedFrom,
          resolvedTo: characterId,
          remapped: !!remappedFrom,
          error: ok ? undefined : error,
        });
      }
      if (ok && remappedFrom) {
        const row = charAgg.get(originalCharacterId)!;
        row.available = false;
        row.remapped = true;
        row.resolvedTo = characterId;
      }
    }

    const willSucceed = sessions.filter((s) => s.ok).length;
    const willFail = sessions.length - willSucceed;
    const totalMessages = sessions
      .filter((s) => s.ok)
      .reduce((n, s) => n + s.messageCount, 0);

    const characters: ImportPreviewCharacter[] = [...charAgg.entries()]
      .map(([id, v]) => ({
        id,
        name: v.name,
        sessionCount: v.sessionCount,
        available: v.available,
        resolvedTo: v.resolvedTo,
        remapped: v.remapped,
        error: v.error,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      dryRun: true,
      sourceSchema: parsed.sourceSchema,
      bulkTotal: parsed.bulkTotal,
      entriesParsed: parsed.entries.length,
      capped: parsed.capped,
      willSucceed,
      willFail,
      totalMessages,
      sessions,
      characters,
    };
  }

  /**
   * Restore a transcript from export JSON into a brand-new session
   * (new id + wsToken; never reuses old secrets).
   *
   * For bulk account exports:
   * - `importAll: true` (default when bulk + no sessionIndex) restores every chat
   * - `sessionIndex` forces a single entry
   * - `importAll: false` with bulk defaults to index 0
   */
  async importSession(
    document: unknown,
    wsBaseUrl: string,
    options: {
      accountId?: string;
      sessionIndex?: number;
      importAll?: boolean;
      /** When importing all, which export index to open as the primary live session. */
      openIndex?: number;
    } & ImportCharacterResolveOptions = {},
  ): Promise<SessionImportResult & { bulk?: BulkImportSummary }> {
    const wantAll =
      options.importAll === true ||
      (options.importAll !== false &&
        options.sessionIndex === undefined &&
        isBulkAccountExport(document));

    if (wantAll && isBulkAccountExport(document)) {
      return this.importSessionsBulk(document, wsBaseUrl, {
        accountId: options.accountId,
        characterId: options.characterId,
        characterMap: options.characterMap,
        fallbackCharacterId: options.fallbackCharacterId,
        openIndex: options.openIndex,
      });
    }

    const parsed = parseImportDocument(document, {
      sessionIndex: options.sessionIndex,
    });
    if (!parsed.ok) {
      throw new SessionImportError(parsed.error, parsed.code);
    }

    return this.materializeImport(parsed.session, wsBaseUrl, {
      accountId: options.accountId,
      characterId: options.characterId,
      characterMap: options.characterMap,
      fallbackCharacterId: options.fallbackCharacterId,
      truncated: parsed.truncated,
      dropped: parsed.dropped,
      bulkIndex: parsed.bulkIndex,
      bulkTotal: parsed.bulkTotal,
    });
  }

  /** Restore every valid chat from a bulk (or single) export. */
  async importSessionsBulk(
    document: unknown,
    wsBaseUrl: string,
    options: {
      accountId?: string;
      /** Prefer this export session index as the live/primary result when it succeeds. */
      openIndex?: number;
    } & ImportCharacterResolveOptions = {},
  ): Promise<SessionImportResult & { bulk: BulkImportSummary }> {
    const parsed = parseImportDocumentAll(document);
    if (!parsed.ok) {
      throw new SessionImportError(parsed.error, parsed.code);
    }

    const results: Array<BulkImportItemOk | BulkImportItemFail> = [];
    let first: SessionImportResult | null = null;
    let preferred: SessionImportResult | null = null;
    let totalMessages = 0;

    for (const entry of parsed.entries) {
      try {
        const created = await this.materializeImport(entry.session, wsBaseUrl, {
          accountId: options.accountId,
          characterId: options.characterId,
          characterMap: options.characterMap,
          fallbackCharacterId: options.fallbackCharacterId,
          truncated: entry.truncated,
          dropped: entry.dropped,
          bulkIndex: entry.index,
          bulkTotal: parsed.bulkTotal,
        });
        totalMessages += created.imported.messageCount;
        results.push({
          ok: true,
          index: entry.index,
          sessionId: created.sessionId,
          characterId: created.characterId,
          characterName: entry.session.characterName,
          messageCount: created.imported.messageCount,
          resumeCode: created.resumeCode,
          remappedFrom: created.imported.remappedFrom,
        });
        if (!first) first = created;
        if (
          typeof options.openIndex === "number" &&
          options.openIndex === entry.index
        ) {
          preferred = created;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Import failed for this session";
        const code = error instanceof SessionImportError ? error.code : undefined;
        results.push({
          ok: false,
          index: entry.index,
          characterId: entry.session.characterId,
          characterName: entry.session.characterName,
          error: message,
          code,
        });
      }
    }

    const primary = preferred ?? first;
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    if (!primary || succeeded === 0) {
      const firstErr = results.find((r) => !r.ok);
      throw new SessionImportError(
        firstErr && !firstErr.ok
          ? `Bulk import failed for all sessions. First error: ${firstErr.error}`
          : "Bulk import failed for all sessions",
        "BULK_EMPTY",
      );
    }

    return {
      ...primary,
      bulk: {
        total: parsed.bulkTotal,
        succeeded,
        failed,
        capped: parsed.capped,
        totalMessages,
        results,
      },
    };
  }

  private async materializeImport(
    payload: ImportSessionPayload,
    wsBaseUrl: string,
    options: {
      accountId?: string;
      truncated?: boolean;
      dropped?: number;
      bulkIndex?: number;
      bulkTotal?: number;
    } & ImportCharacterResolveOptions,
  ): Promise<SessionImportResult> {
    let resolved: { characterId: string; remappedFrom?: string };
    try {
      resolved = resolveImportCharacterId(payload.characterId, {
        characterId: options.characterId,
        characterMap: options.characterMap,
        fallbackCharacterId: options.fallbackCharacterId,
      });
      assertLiveCharacter(resolved.characterId);
    } catch (error) {
      if (error instanceof SessionImportError) throw error;
      if (error instanceof LiveCharacterError) {
        throw new SessionImportError(error.message, "CHARACTER_MISSING");
      }
      throw error;
    }

    const characterId = resolved.characterId;
    const promptVersion = payload.promptVersion || DEFAULT_PROMPT_VERSION;
    const promptSnapshot = await createPromptSnapshot(characterId, promptVersion);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMinutes * 60_000);
    const sessionId = randomUUID();
    const wsToken = randomUUID();
    const resumeCode = await registerResumeCode(sessionId, options.accountId);

    const messages = payload.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));

    const windowed =
      messages.length > this.maxMessageWindow
        ? messages.slice(-this.maxMessageWindow)
        : messages;

    const defaultAvatar = this.memory.defaultAvatarState(promptSnapshot.characterId);
    const avatarState = payload.avatarState
      ? {
          ...defaultAvatar,
          emotion: payload.avatarState.emotion || defaultAvatar.emotion,
          pose: payload.avatarState.pose || defaultAvatar.pose,
          action: payload.avatarState.action || defaultAvatar.action,
          arousalLevel:
            typeof payload.avatarState.arousalLevel === "number"
              ? payload.avatarState.arousalLevel
              : defaultAvatar.arousalLevel,
          clothingState:
            payload.avatarState.clothingState || defaultAvatar.clothingState,
        }
      : defaultAvatar;

    const record: SessionRecord = {
      id: sessionId,
      characterId: promptSnapshot.characterId,
      promptVersion: promptSnapshot.promptVersion,
      promptSnapshot,
      wsToken,
      status: "active",
      memory: { messages: windowed },
      avatarState,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      resumeCode,
      ...(options.accountId ? { accountId: options.accountId } : {}),
    };

    this.sessions.set(sessionId, record);
    await this.persist(record);

    return {
      ...this.toCreateResult(record, wsBaseUrl),
      messages: windowed,
      imported: {
        messageCount: windowed.length,
        originalSessionId:
          payload.sessionId !== "imported" ? payload.sessionId : undefined,
        originalCharacterId: payload.characterId,
        characterId: promptSnapshot.characterId,
        ...(resolved.remappedFrom ? { remappedFrom: resolved.remappedFrom } : {}),
        truncated: options.truncated === true || messages.length > windowed.length,
        dropped: options.dropped,
        bulkIndex: options.bulkIndex,
        bulkTotal: options.bulkTotal,
      },
    };
  }

  private async reactivate(
    session: SessionRecord,
    wsBaseUrl: string,
  ): Promise<CreateSessionResult & { messages: SessionRecord["memory"]["messages"] }> {
    const now = new Date();
    const hardExpiry = new Date(session.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000;
    if (hardExpiry < now.getTime()) {
      throw new SessionAuthError("Session archive expired (14 day limit)");
    }

    assertLiveCharacter(session.characterId);

    let resumeCode = session.resumeCode;
    if (!resumeCode) {
      resumeCode = await registerResumeCode(session.id, session.accountId);
    } else {
      await registerResumeCode(session.id, session.accountId, resumeCode);
    }

    const updated: SessionRecord = {
      ...session,
      wsToken: randomUUID(),
      status: "active",
      resumeCode,
      expiresAt: new Date(now.getTime() + this.sessionTtlMinutes * 60_000).toISOString(),
      updatedAt: now.toISOString(),
    };

    this.sessions.set(session.id, updated);
    await this.persist(updated);

    return {
      ...this.toCreateResult(updated, wsBaseUrl),
      messages: updated.memory.messages ?? [],
    };
  }

  private async loadSession(sessionId: string): Promise<SessionRecord> {
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;

    const fromDisk = await loadSessionRecord(sessionId);
    if (!fromDisk) {
      throw new SessionNotFoundError(sessionId);
    }
    this.sessions.set(sessionId, fromDisk);
    return fromDisk;
  }

  private async persist(record: SessionRecord): Promise<void> {
    try {
      await saveSessionRecord(record);
    } catch (error) {
      console.error(`[session-store] persist failed for ${record.id}:`, error);
    }
  }

  private toCreateResult(record: SessionRecord, wsBaseUrl: string): CreateSessionResult {
    return {
      sessionId: record.id,
      wsToken: record.wsToken,
      characterId: record.characterId,
      promptVersion: record.promptVersion,
      wsUrl: `${wsBaseUrl}/ws/sessions/${record.id}?token=${record.wsToken}`,
      avatarState: record.avatarState,
      resumeCode: record.resumeCode,
      accountId: record.accountId,
    };
  }

  private assertNotExpired(session: SessionRecord): void {
    if (session.status === "ended") {
      return;
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = "ended";
      this.sessions.set(session.id, session);
      void this.persist(session);
      // Allow callers that only need the archive (resume) to still load the record;
      // active-path callers check status separately.
    }
  }
}
