"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarPanel } from "@/components/AvatarPanel";
import { AvatarPip } from "@/components/AvatarPip";
import { AvatarVideo } from "@/components/AvatarVideo";
import { ClipPreview } from "@/components/ClipPreview";
import { ImportPreviewPanel } from "@/components/ImportPreviewPanel";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
import { LiveKitBadge } from "@/components/LiveKitBadge";
import { TypingIndicator } from "@/components/TypingIndicator";
import { mergeAvatarState } from "@/lib/avatar-merge";
import {
  claimSession,
  createCustomCharacter,
  createSession,
  deleteCustomCharacter,
  exportLiveSession,
  fetchBaseModelPrefill,
  fetchLiveSessionMarkdown,
  getCrossSessionMemoryOptIn,
  importFlashSummary,
  importSessionDocument,
  listAccountSessions,
  listLiveCharacters,
  setCrossSessionMemoryOptIn,
  clearCrossSessionMemory,
  fetchAccountMe,
  linkEmailToAccount,
  loginAccount,
  logoutAccount,
  previewImportDocument,
  registerAccount,
  requestMagicLink,
  resumeAccountSession,
  resumeByCode,
  fetchSessionMemory,
  resumeSession,
  updateCustomCharacter,
  uploadCharacterClip,
  uploadCharacterClipsBatch,
  verifyMagicLink,
  isAccountAuthError,
  type AccountSessionSummary,
  type ImportPreview,
} from "@/lib/api";
import { SessionAuthBanner } from "@/components/SessionAuthBanner";
import { InstallAppHint } from "@/components/InstallAppHint";
import { SessionDropRescue } from "@/components/SessionDropRescue";
import {
  ComposerVibeChip,
  edgePaceComposerClass,
} from "@/components/ComposerVibeChip";
import { EdgePaceStrip } from "@/components/EdgePaceStrip";
import { OpeningLinePreview } from "@/components/OpeningLinePreview";
import { RejoinRecapToast } from "@/components/RejoinRecapToast";
import { SessionMemoryStrip } from "@/components/SessionMemoryStrip";
import { ChatResumeHero } from "@/components/ChatResumeHero";
import { DraftRecoveryHint } from "@/components/DraftRecoveryHint";
import { EdgePaceStartHint } from "@/components/EdgePaceStartHint";
import { AfterglowChips } from "@/components/AfterglowChips";
import { HeatWhisperStrip } from "@/components/HeatWhisperStrip";
import { QuickReplyChips } from "@/components/QuickReplyChips";
import { SessionDepthMeter } from "@/components/SessionDepthMeter";
import { SessionPausedBanner } from "@/components/SessionPausedBanner";
import { SessionWinToast } from "@/components/SessionWinToast";
import { SoftSupportHint } from "@/components/SoftSupportHint";
import {
  collectExportCharacters,
  partitionCharacters,
  suggestFallbackId,
  type ExportCharacterRef,
} from "@/lib/import-characters";
import {
  clearStoredAccount,
  DEFAULT_REAUTH_NOTICE,
  invalidateStoredAccount,
  loadStoredAccount,
  saveStoredAccount,
  type StoredAccount,
} from "@/lib/account-storage";
import {
  clearComposerDraft,
  clearStoredSession,
  loadComposerDraft,
  loadStoredSession,
  saveComposerDraft,
  saveStoredSession,
  type StoredSession,
} from "@/lib/session-storage";
import {
  buildCharacterShareUrl,
  buildResumeCodeShareUrl,
  canNativeShare,
  copyText,
  parseShareQuery,
  replaceCharacterInUrl,
  shareOrCopyText,
  shareOrCopyUrl,
  shareResultLabel,
  shareUrlResultLabel,
} from "@/lib/share-links";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  energyBandBadgeClass,
  energyBandFromAvatar,
  energyBandLabel,
  type EnergyBand,
} from "@/lib/energy";
import {
  presenceAmbientClass,
  presenceBubbleClass,
  resolvePresenceSkin,
} from "@/lib/presence";
import {
  getResumeForCharacter,
  recapFromSessionNotes,
  rememberResumeRecap,
} from "@/lib/resume-cache";
import type {
  AvatarState,
  CharacterId,
  ChatMessage,
  ConnectionStatus,
  LiveCharacterOption,
  LiveKitJoinInfo,
  MediaClipKey,
  MemoryMessage,
  SessionMode,
  SessionModeUiState,
} from "@/lib/types";

const FALLBACK_CHARACTERS: LiveCharacterOption[] = [
  {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.3.1",
    kind: "default",
    featured: true,
    openingMessage:
      "mmm hey… sheer thong already on, and i’m not rushing. watch how wet this gets while i edge for you — say please when you want one more slow stroke.",
  },
  {
    id: "female-default",
    displayName: "Female Default",
    defaultVersion: "v1.3.1",
    kind: "default",
    featured: true,
    openingMessage:
      "there you are… crotchless on purpose, already a little shiny. don’t rush me — watch first, then maybe i’ll touch for you.",
  },
  {
    id: "twink-shy-boy",
    displayName: "Diego",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    openingMessage:
      "hi… um. it’s diego. i left the sheer thong on so you can see everything if you want. i’m already a little hard. don’t make me go fast… just watch me for a second?",
  },
  {
    id: "twink-gym",
    displayName: "Mateo",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    openingMessage:
      "mateo. just finished my set… shorts off, sheer thong still on, and i’m already tenting. you watching the cool-down? keep your eyes on the pouch — we’re edging this burn, not finishing it yet.",
  },
  {
    id: "twink-alt-punk",
    displayName: "Rio",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    openingMessage:
      "rio. lights low, sheer mesh on, already wet at the tip. don’t ask if i’m hard — look. we’re not finishing. we’re playing with it until you get desperate.",
  },
  {
    id: "female-soft-goth",
    displayName: "Luna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    openingMessage:
      "luna… lights low. black crotchless lace on, already a little shiny for you. don’t rush me. just look at the open panel and breathe with me.",
  },
  {
    id: "female-athletic-tease",
    displayName: "Sienna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    openingMessage:
      "sienna. workout done, sports bra off, crotchless still on — and yeah, i’m already wet in the open panel. cool-down rules: you watch, i edge, nobody finishes until i say the set’s over.",
  },
  {
    id: "female-playful-brat",
    displayName: "Mila",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    openingMessage:
      "hi hi~ mila. crotchless on, already a little wet, and no — you don’t get to rush. look at the open panel and ask nicely. maybe i’ll edge for you… if you’re fun.",
  },
];

function makeId(): string {
  return crypto.randomUUID();
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === "ready"
      ? "bg-emerald-400"
      : status === "connecting"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-red-400"
          : "bg-brand-muted";

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function ChatApp() {
  const [characters, setCharacters] = useState<LiveCharacterOption[]>(FALLBACK_CHARACTERS);
  const [character, setCharacter] = useState<CharacterId>("twink-default");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState | null>(null);
  const [livekit, setLivekit] = useState<LiveKitJoinInfo | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAppearance, setCustomAppearance] = useState("");
  const [customEnergy, setCustomEnergy] = useState("");
  const [customClothing, setCustomClothing] = useState("");
  /** Signature base (any of 8). */
  const [customBaseModel, setCustomBaseModel] = useState("twink-default");
  const [customBase, setCustomBase] = useState<"twink-default" | "female-default">("twink-default");
  const [customPhrase1, setCustomPhrase1] = useState("");
  const [customPhrase2, setCustomPhrase2] = useState("");
  const [customPhrase3, setCustomPhrase3] = useState("");
  const [customScene1Title, setCustomScene1Title] = useState("");
  const [customScene1Body, setCustomScene1Body] = useState("");
  const [customScene2Title, setCustomScene2Title] = useState("");
  const [customScene2Body, setCustomScene2Body] = useState("");
  const [customScene3Title, setCustomScene3Title] = useState("");
  const [customScene3Body, setCustomScene3Body] = useState("");
  const [mediaBase, setMediaBase] = useState("");
  const [clipIdle, setClipIdle] = useState("");
  const [clipTeasing, setClipTeasing] = useState("");
  const [clipPlayful, setClipPlayful] = useState("");
  const [clipAroused, setClipAroused] = useState("");
  const [showMediaAdvanced, setShowMediaAdvanced] = useState(false);
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [resumeCode, setResumeCode] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [accountHandle, setAccountHandle] = useState("");
  const [accountPass, setAccountPass] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [magicDevLink, setMagicDevLink] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSessions, setAccountSessions] = useState<AccountSessionSummary[]>([]);
  const [accountEmailLinked, setAccountEmailLinked] = useState<string | null>(null);
  const [resumeCodeInput, setResumeCodeInput] = useState("");
  /** Hide avatar video/panel for more transcript space. */
  const [avatarCollapsed, setAvatarCollapsed] = useState(false);
  /** Floating mini player while collapsed (picture-in-picture style). */
  const [avatarPip, setAvatarPip] = useState(true);
  /** Phase 6: compact "what we remember" blurb. */
  const [sessionNotes, setSessionNotes] = useState<string | null>(null);
  /** Soft “pick up the heat” banner after resume / rejoin. */
  const [rejoinRecap, setRejoinRecap] = useState<{
    line: string | null;
    show: boolean;
  }>({ line: null, show: false });
  /** Brief send-button heat feedback. */
  const [sendPulse, setSendPulse] = useState(false);
  /** Soft glow when a full assistant message lands. */
  const [arrivalId, setArrivalId] = useState<string | null>(null);
  /** User scrolled up — pause pin-to-bottom, show jump pill. */
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [bandFlash, setBandFlash] = useState<EnergyBand | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const prevEnergyBandRef = useRef<EnergyBand | null>(null);
  const skipDraftSaveRef = useRef(false);
  /** Snapshot after End — morph goodbye into return. */
  const [pauseSnapshot, setPauseSnapshot] = useState<{
    characterId: string;
    characterName: string | null;
    resumeCode: string | null;
    messageCount: number;
  } | null>(null);
  /** Live session stopwatch (seconds) while status === ready. */
  const [liveSeconds, setLiveSeconds] = useState(0);
  const liveStartedAtRef = useRef<number | null>(null);
  /** Opt-in long-term dossier (across sessions). */
  const [priorNotes, setPriorNotes] = useState<string | null>(null);
  const [messageWindow, setMessageWindow] = useState<20 | 30 | 50 | 80>(30);
  const [crossSessionOptIn, setCrossSessionOptIn] = useState(false);
  const [livekitRoomStatus, setLivekitRoomStatus] = useState<
    "off" | "connecting" | "connected" | "error"
  >("off");
  /** Phase 10 assistant mode (persisted preference for new sessions). */
  const [sessionMode, setSessionMode] = useState<SessionMode>(() => {
    if (typeof window === "undefined") return "normal";
    try {
      const raw = window.localStorage.getItem("procharacters.sessionMode.v1");
      return raw === "edge_pace" ? "edge_pace" : "normal";
    } catch {
      return "normal";
    }
  });
  const [modeState, setModeState] = useState<SessionModeUiState | null>(null);
  const [modeTick, setModeTick] = useState(0);
  /** Unexpected WS drop while a session was live — show Rejoin rescue. */
  const [connectionDropped, setConnectionDropped] = useState(false);

  // Import JSON dry-run (same panel as account settings)
  const [importDoc, setImportDoc] = useState<unknown | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMissing, setImportMissing] = useState<ExportCharacterRef[]>([]);
  const [importCharacterMap, setImportCharacterMap] = useState<Record<string, string>>({});
  const [importFallbackId, setImportFallbackId] = useState("twink-default");
  const [importBusy, setImportBusy] = useState(false);
  /** Which bulk export session to open live after confirm. */
  const [importOpenIndex, setImportOpenIndex] = useState<number | null>(null);

  const handleAvatarSync = useCallback((avatar: AvatarState) => {
    setAvatarState((prev) => mergeAvatarState(prev, avatar) ?? avatar);
  }, []);

  const setAvatarCollapsedPersist = useCallback((next: boolean) => {
    setAvatarCollapsed(next);
    try {
      window.localStorage.setItem("pc_avatar_collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
    // Re-show PiP when collapsing again so user always gets the mini feed
    if (next) {
      setAvatarPip(true);
      try {
        window.localStorage.setItem("pc_avatar_pip", "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setAvatarPipPersist = useCallback((next: boolean) => {
    setAvatarPip(next);
    try {
      window.localStorage.setItem("pc_avatar_pip", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("pc_avatar_collapsed");
      if (raw === "1") setAvatarCollapsed(true);
      const pip = window.localStorage.getItem("pc_avatar_pip");
      if (pip === "0") setAvatarPip(false);
    } catch {
      /* ignore */
    }
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingHistoryRef = useRef<ChatMessage[] | null>(null);
  const deepLinkHandledRef = useRef(false);
  /** True only for deliberate closes (End, Switch, unmount) — suppresses rescue banner. */
  const intentionalCloseRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<ConnectionStatus>("idle");
  const liveCredsRef = useRef<{
    sessionId: string;
    wsToken: string;
    characterId: string;
    characterName: string | null;
    resumeCode: string | null;
  } | null>(null);

  const closeSocket = useCallback((sendEnd = true) => {
    const ws = wsRef.current;
    if (!ws) {
      // No onclose will fire — do not leave intentionalCloseRef stuck true.
      intentionalCloseRef.current = false;
      return;
    }

    if (sendEnd && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end_session" }));
    }
    ws.close();
    wsRef.current = null;
  }, []);

  const clearSessionState = useCallback(() => {
    setSessionId(null);
    setWsToken(null);
    setResumeCode(null);
    setCharacterName(null);
    setActiveCharacterId(null);
    setMessages([]);
    setAvatarState(null);
    setLivekit(null);
    setSending(false);
    setIsTyping(false);
    setSessionNotes(null);
    setPriorNotes(null);
    setModeState(null);
    setConnectionDropped(false);
    streamingIdRef.current = null;
    pendingHistoryRef.current = null;
    liveCredsRef.current = null;
  }, []);

  const refreshAccountSessions = useCallback(async (token: string) => {
    try {
      const [sessions, me] = await Promise.all([
        listAccountSessions(token),
        fetchAccountMe(token),
      ]);
      setAccountSessions(sessions);
      setAccountEmailLinked(me?.email ?? null);
    } catch (err) {
      setAccountSessions([]);
      if (isAccountAuthError(err)) {
        invalidateStoredAccount(DEFAULT_REAUTH_NOTICE);
        setAccount(null);
        setAccountEmailLinked(null);
      }
    }
  }, []);

  const rememberSession = useCallback(
    (info: {
      sessionId: string;
      wsToken: string;
      characterId: string;
      characterName?: string | null;
      resumeCode?: string | null;
      resumeExpiresAt?: string | null;
    }) => {
      const stored: StoredSession = {
        sessionId: info.sessionId,
        wsToken: info.wsToken,
        characterId: info.characterId,
        characterName: info.characterName ?? undefined,
        resumeCode: info.resumeCode ?? undefined,
        resumeExpiresAt: info.resumeExpiresAt ?? undefined,
        savedAt: new Date().toISOString(),
      };
      saveStoredSession(stored);
      setSavedSession(stored);
      if (info.resumeCode) {
        void import("@/lib/resume-cache").then(({ rememberLocalResume }) => {
          rememberLocalResume({
            characterId: info.characterId,
            characterName: info.characterName,
            sessionId: info.sessionId,
            resumeCode: info.resumeCode!,
            resumeExpiresAt: info.resumeExpiresAt,
          });
        });
      }
    },
    [],
  );

  const endSession = useCallback(() => {
    // End on server but keep local resume credentials (memory is persisted server-side).
    intentionalCloseRef.current = true;
    setConnectionDropped(false);
    const cid = activeCharacterId ?? character;
    setPauseSnapshot({
      characterId: cid,
      characterName,
      resumeCode: resumeCode ?? savedSession?.resumeCode ?? null,
      messageCount: messages.length,
    });
    closeSocket(true);
    if (sessionId && wsToken && cid) {
      rememberSession({
        sessionId,
        wsToken,
        characterId: cid,
        characterName,
        resumeCode,
      });
    }
    clearSessionState();
    setStatus("idle");
    setError(null);
    setRestarting(false);
  }, [
    activeCharacterId,
    character,
    characterName,
    clearSessionState,
    closeSocket,
    messages.length,
    rememberSession,
    resumeCode,
    savedSession?.resumeCode,
    sessionId,
    wsToken,
  ]);

  useEffect(() => {
    if (!stickToBottom) {
      setShowJumpLatest(true);
      return;
    }
    setShowJumpLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, stickToBottom]);

  // Energy band flash in transcript chrome when avatar heat shifts
  useEffect(() => {
    if (!avatarState) return;
    const band = energyBandFromAvatar(avatarState);
    if (prevEnergyBandRef.current === null) {
      prevEnergyBandRef.current = band;
      return;
    }
    if (prevEnergyBandRef.current === band) return;
    prevEnergyBandRef.current = band;
    setBandFlash(band);
    const t = window.setTimeout(() => setBandFlash(null), 2200);
    return () => window.clearTimeout(t);
  }, [avatarState]);

  // Live session clock — soft depth context, not a hard timer product
  useEffect(() => {
    if (status === "ready") {
      if (liveStartedAtRef.current == null) {
        liveStartedAtRef.current = Date.now();
        setLiveSeconds(0);
      }
      const t = window.setInterval(() => {
        const start = liveStartedAtRef.current ?? Date.now();
        setLiveSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => window.clearInterval(t);
    }
    liveStartedAtRef.current = null;
    setLiveSeconds(0);
  }, [status]);

  // Per-character composer drafts — swap brains without losing unsent heat
  useEffect(() => {
    skipDraftSaveRef.current = true;
    setInput(loadComposerDraft(character));
  }, [character]);

  useEffect(() => {
    if (!character) return;
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      saveComposerDraft(character, input);
    }, 280);
    return () => window.clearTimeout(t);
  }, [input, character]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (sessionId && wsToken) {
      liveCredsRef.current = {
        sessionId,
        wsToken,
        characterId: activeCharacterId ?? character,
        characterName,
        resumeCode,
      };
    }
  }, [sessionId, wsToken, activeCharacterId, character, characterName, resumeCode]);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      closeSocket(false);
    };
  }, [closeSocket]);

  useEffect(() => {
    let cancelled = false;
    listLiveCharacters(account?.token)
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setCharacters(list);
        const query = parseShareQuery(window.location.search);
        setCharacter((current) => {
          if (query.characterId && list.some((c) => c.id === query.characterId)) {
            return query.characterId!;
          }
          return list.some((c) => c.id === current) ? current : list[0]!.id;
        });
      })
      .catch(() => {
        /* keep fallback list */
      });
    return () => {
      cancelled = true;
    };
  }, [account?.token]);

  useEffect(() => {
    setSavedSession(loadStoredSession());
    const storedAccount = loadStoredAccount();
    setAccount(storedAccount);
    if (storedAccount) {
      void refreshAccountSessions(storedAccount.token);
    }
  }, [refreshAccountSessions]);

  // Prefill identity/vibe/clothing from selected base model (Phase 5)
  useEffect(() => {
    if (!showCreate) return;
    let cancelled = false;
    void fetchBaseModelPrefill(customBaseModel)
      .then((p) => {
        if (cancelled) return;
        setCustomBase(p.avatarBase);
        setCustomAppearance((prev) => (prev.trim().length >= 12 ? prev : p.identityHint));
        setCustomEnergy((prev) => (prev.trim().length >= 4 ? prev : p.vibeHint));
        setCustomClothing((prev) => (prev.trim().length >= 2 ? prev : p.clothingHint));
      })
      .catch(() => {
        /* keep manual fields */
      });
    return () => {
      cancelled = true;
    };
  }, [customBaseModel, showCreate]);

  // Prefill clip editors when a custom character is selected.
  useEffect(() => {
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") return;
    setMediaBase(selected.mediaBase ?? "");
    setClipIdle(selected.mediaOverrides?.idle ?? "");
    setClipTeasing(selected.mediaOverrides?.teasing ?? "");
    setClipPlayful(selected.mediaOverrides?.playful ?? "");
    setClipAroused(selected.mediaOverrides?.aroused ?? "");
  }, [character, characters]);

  // Keep address bar shareable without private tokens after boot.
  useEffect(() => {
    if (status === "idle" || status === "ended" || status === "error") {
      replaceCharacterInUrl(character);
    }
  }, [character, status]);

  const bindWebSocket = useCallback(
    (
      ws: WebSocket,
      session: { sessionId: string; characterId: string; wsToken: string },
    ) => {
      ws.onopen = () => {
        setSessionId(session.sessionId);
        setWsToken(session.wsToken);
        setActiveCharacterId(session.characterId);
      };

      ws.onmessage = (event) => {
        let data: { type: string; [key: string]: unknown };
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }

        switch (data.type) {
          case "session_ready": {
            setStatus("ready");
            setConnectionDropped(false);
            const name = (data.characterName as string) ?? null;
            setCharacterName(name);
            if (data.avatarState) {
              setAvatarState(data.avatarState as AvatarState);
            }
            if (data.sessionMode === "edge_pace" || data.sessionMode === "normal") {
              setSessionMode(data.sessionMode);
            }
            if (data.modeState && typeof data.modeState === "object") {
              setModeState(data.modeState as SessionModeUiState);
              setModeTick(0);
            }
            let notesForRecap: string | null = null;
            if (typeof data.sessionNotes === "string" && data.sessionNotes.trim()) {
              const notes = data.sessionNotes.trim();
              notesForRecap = notes;
              setSessionNotes(notes);
              rememberResumeRecap(session.characterId, recapFromSessionNotes(notes));
            }
            let priorForRecap: string | null = null;
            if (typeof data.priorNotes === "string" && data.priorNotes.trim()) {
              priorForRecap = data.priorNotes.trim();
              setPriorNotes(priorForRecap);
            }
            const historyFromServer = Array.isArray(data.messages)
              ? (data.messages as MemoryMessage[]).map((m) => ({
                  id: m.id,
                  role: m.role as ChatMessage["role"],
                  content: m.content,
                }))
              : null;
            const history = historyFromServer?.length
              ? historyFromServer
              : pendingHistoryRef.current;
            if (history?.length) {
              setMessages(history);
            }
            pendingHistoryRef.current = null;
            // Returning with history or memory → soft recap before they scroll
            const cachedRecap = getResumeForCharacter(session.characterId)?.recapLine ?? null;
            const line =
              recapFromSessionNotes(notesForRecap) || cachedRecap || null;
            if (history?.length || priorForRecap || line) {
              setRejoinRecap({ line, show: true });
            }
            rememberSession({
              sessionId: session.sessionId,
              wsToken: session.wsToken,
              characterId: session.characterId,
              characterName: name,
              resumeCode,
            });
            setRestarting(false);
            inputRef.current?.focus();
            break;
          }

          case "assistant_stream": {
            const messageId = data.messageId as string;
            const chunk = data.chunk as string;
            setIsTyping(false);

            if (streamingIdRef.current !== messageId) {
              streamingIdRef.current = messageId;
              setMessages((prev) => [
                ...prev,
                { id: messageId, role: "assistant", content: chunk, streaming: true },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg,
                ),
              );
            }
            break;
          }

          case "assistant_complete": {
            const messageId = data.messageId as string;
            const content = data.content as string;
            const avatarIntent = data.avatarIntent as AvatarState | undefined;
            const notes = data.sessionNotes as string | undefined;
            streamingIdRef.current = null;
            setSending(false);
            setIsTyping(false);

            if (avatarIntent) {
              setAvatarState((prev) => mergeAvatarState(prev, avatarIntent) ?? avatarIntent);
            }
            if (notes?.trim()) {
              const trimmed = notes.trim();
              setSessionNotes(trimmed);
              rememberResumeRecap(
                session.characterId,
                recapFromSessionNotes(trimmed),
              );
            }
            if (typeof data.priorNotes === "string" && data.priorNotes.trim()) {
              setPriorNotes(data.priorNotes.trim());
            }
            if (data.modeState && typeof data.modeState === "object") {
              setModeState(data.modeState as SessionModeUiState);
              setModeTick(0);
            }

            setArrivalId(messageId);
            window.setTimeout(() => {
              setArrivalId((cur) => (cur === messageId ? null : cur));
            }, 900);

            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === messageId);
              if (exists) {
                return prev.map((msg) =>
                  msg.id === messageId ? { ...msg, content, streaming: false } : msg,
                );
              }
              return [
                ...prev,
                { id: messageId, role: "assistant", content, streaming: false },
              ];
            });
            break;
          }

          case "avatar_update":
            setAvatarState((prev) => {
              const next = data.avatarState as AvatarState;
              return mergeAvatarState(prev, next) ?? next;
            });
            break;

          case "session_ended": {
            // Soft end — keep credentials so user can rejoin without a dead composer.
            const code = resumeCode ?? liveCredsRef.current?.resumeCode ?? null;
            rememberSession({
              sessionId: session.sessionId,
              wsToken: session.wsToken,
              characterId: session.characterId,
              characterName:
                liveCredsRef.current?.characterName ?? characterName,
              resumeCode: code,
            });
            if (code || (session.sessionId && session.wsToken)) {
              setConnectionDropped(true);
            }
            setStatus("ended");
            intentionalCloseRef.current = true;
            closeSocket(false);
            break;
          }

          case "error":
            setError((data.message as string) ?? "Unknown server error");
            setStatus("error");
            setSending(false);
            setIsTyping(false);
            setRestarting(false);
            break;
        }
      };

      ws.onerror = () => {
        const wasLive =
          statusRef.current === "ready" ||
          statusRef.current === "connecting" ||
          !!sessionIdRef.current;
        if (wasLive) {
          const creds = liveCredsRef.current;
          if (creds) {
            rememberSession({
              sessionId: creds.sessionId,
              wsToken: creds.wsToken,
              characterId: creds.characterId,
              characterName: creds.characterName,
              resumeCode: creds.resumeCode,
            });
          }
          setConnectionDropped(true);
          setStatus("ended");
          setSending(false);
          setIsTyping(false);
          setRestarting(false);
          return;
        }
        setError("WebSocket connection failed");
        setStatus("error");
        setSending(false);
        setIsTyping(false);
        setRestarting(false);
      };

      ws.onclose = () => {
        const intentional = intentionalCloseRef.current;
        intentionalCloseRef.current = false;
        wsRef.current = null;
        setSending(false);
        setIsTyping(false);
        setRestarting(false);
        if (intentional) return;

        const wasLive =
          statusRef.current === "ready" ||
          statusRef.current === "connecting" ||
          !!sessionIdRef.current;
        if (wasLive) {
          const creds = liveCredsRef.current;
          if (creds) {
            rememberSession({
              sessionId: creds.sessionId,
              wsToken: creds.wsToken,
              characterId: creds.characterId,
              characterName: creds.characterName,
              resumeCode: creds.resumeCode,
            });
          }
          setConnectionDropped(true);
          setStatus("ended");
        }
      };
    },
    [characterName, closeSocket, rememberSession, resumeCode],
  );

  const openLiveSession = useCallback(
    async (
      session: {
        sessionId: string;
        characterId: string;
        wsToken: string;
        wsUrl: string;
        avatarState: AvatarState;
        livekit?: LiveKitJoinInfo;
        messages?: MemoryMessage[];
        resumeCode?: string;
        resumeExpiresAt?: string;
        sessionNotes?: string;
        priorNotes?: string;
        rehydrate?: boolean;
        sceneLock?: string;
      },
      options?: { forceRehydrate?: boolean },
    ) => {
      let history = (session.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content,
      }));
      let notes = session.sessionNotes?.trim() || null;
      let prior = session.priorNotes?.trim() || null;

      // Continue / resume code: always pull full server memory so UI + next turn match.
      const shouldRehydrate =
        options?.forceRehydrate === true ||
        session.rehydrate === true ||
        !!session.resumeCode;
      if (shouldRehydrate) {
        try {
          const mem = await fetchSessionMemory(session.sessionId, session.wsToken);
          if (mem.recentMessages?.length) {
            history = mem.recentMessages.map((m) => ({
              id: m.id,
              role: m.role as ChatMessage["role"],
              content: m.content,
            }));
          }
          if (mem.sessionNotes?.trim()) notes = mem.sessionNotes.trim();
          if (mem.priorNotes?.trim()) prior = mem.priorNotes.trim();
        } catch {
          /* resume payload messages are enough if /memory fails */
        }
      }

      pendingHistoryRef.current = history.length ? history : null;
      if (history.length) setMessages(history);
      else setMessages([]);
      setSessionNotes(notes);
      setPriorNotes(prior);
      setCharacter(session.characterId);
      setAvatarState(session.avatarState);
      setLivekit(session.livekit ?? null);
      setWsToken(session.wsToken);
      setResumeCode(session.resumeCode ?? null);
      if (session.resumeCode) {
        rememberSession({
          sessionId: session.sessionId,
          wsToken: session.wsToken,
          characterId: session.characterId,
          characterName,
          resumeCode: session.resumeCode,
          resumeExpiresAt: session.resumeExpiresAt,
        });
      }
      // Sliding resume TTL: server extends on every open/resume
      if (session.resumeCode && session.resumeExpiresAt && history.length > 0) {
        const exp = Date.parse(session.resumeExpiresAt);
        if (!Number.isNaN(exp)) {
          const days = Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000));
          const sceneBit = session.sceneLock
            ? " · scene locked"
            : notes
              ? " · heat restored"
              : " · memory restored";
          setCopyNotice(
            days > 1
              ? `Resume code extended · ~${days}d left${sceneBit}`
              : `Resume code extended${sceneBit}`,
          );
          window.setTimeout(() => setCopyNotice(null), 3200);
        }
      } else if (shouldRehydrate && history.length > 0) {
        setCopyNotice(
          session.sceneLock
            ? `Memory restored · ${session.sceneLock}`
            : `Memory restored · ${history.length} messages`,
        );
        window.setTimeout(() => setCopyNotice(null), 2800);
      }
      const ws = new WebSocket(session.wsUrl);
      wsRef.current = ws;
      bindWebSocket(ws, {
        sessionId: session.sessionId,
        characterId: session.characterId,
        wsToken: session.wsToken,
      });
    },
    [bindWebSocket, characterName, rememberSession],
  );

  const connectSession = useCallback(
    async (
      characterId: CharacterId,
      options?: { sessionMode?: SessionMode },
    ) => {
      setError(null);
      setStatus("connecting");
      pendingHistoryRef.current = null;
      setSessionNotes(null);
      // Keep priorNotes preview while connecting if remember is on
      if (!crossSessionOptIn) setPriorNotes(null);
      setModeState(null);

      // Sticky by default: persist opt-in before create so dossier actually saves.
      if (account?.token && crossSessionOptIn) {
        try {
          await setCrossSessionMemoryOptIn(account.token, characterId, true);
        } catch {
          /* still try create with flag */
        }
      }

      const mode = options?.sessionMode ?? sessionMode;
      const session = await createSession(characterId, account?.token, {
        messageWindow,
        useCrossSessionMemory: !!account?.token && crossSessionOptIn,
        sessionMode: mode,
      });
      if (session.sessionMode) setSessionMode(session.sessionMode);
      else if (options?.sessionMode) setSessionMode(options.sessionMode);
      await openLiveSession(session);
    },
    [account?.token, openLiveSession, messageWindow, crossSessionOptIn, sessionMode],
  );

  // Local countdown for edge_pace UI between WS updates
  useEffect(() => {
    if (!modeState || modeState.mode !== "edge_pace" || status !== "ready") return;
    const id = window.setInterval(() => setModeTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [modeState?.mode, modeState?.phase, modeState?.phaseRemainingSec, status]);

  // Reset tick when server pushes a new phase snapshot
  useEffect(() => {
    setModeTick(0);
  }, [modeState?.phase, modeState?.phaseRemainingSec, modeState?.label]);

  // Remember mode preference for next Start (deep-link still wins on first load)
  useEffect(() => {
    try {
      window.localStorage.setItem("procharacters.sessionMode.v1", sessionMode);
    } catch {
      /* ignore */
    }
  }, [sessionMode]);

  // Load cross-session opt-in when signed in + character changes.
  // Never configured → sticky ON by default for signed-in (can uncheck anytime).
  useEffect(() => {
    if (!account?.token) {
      setCrossSessionOptIn(false);
      return;
    }
    let cancelled = false;
    void getCrossSessionMemoryOptIn(account.token, character)
      .then((r) => {
        if (cancelled) return;
        const defaultOn = r.neverConfigured === true || (!r.updatedAt && !r.notes);
        setCrossSessionOptIn(defaultOn ? true : r.optIn === true);
        // Preview prior heat before Start — feels like they never left.
        if (r.notes?.trim() && (r.optIn === true || defaultOn || r.hasDurable)) {
          setPriorNotes(r.notes.trim());
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Signed-in but offline status — still prefer sticky default
          setCrossSessionOptIn(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [account?.token, character]);

  const connectResumedSession = useCallback(
    async (stored: StoredSession) => {
      setError(null);
      setStatus("connecting");
      const session = await resumeSession(stored.sessionId, stored.wsToken);
      await openLiveSession(session);
    },
    [openLiveSession],
  );

  const startSession = async (
    characterId: CharacterId = character,
    options?: { sessionMode?: SessionMode },
  ) => {
    clearSessionState();
    setCharacter(characterId);
    if (options?.sessionMode) setSessionMode(options.sessionMode);
    replaceCharacterInUrl(characterId);
    try {
      await connectSession(characterId, options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStatus("error");
      setRestarting(false);
    }
  };

  const clearImportDraft = useCallback(() => {
    setImportDoc(null);
    setImportPreview(null);
    setImportMissing([]);
    setImportCharacterMap({});
    setImportOpenIndex(null);
  }, []);

  const loadChatImportPreview = async (
    document: unknown,
    options?: { characterMap?: Record<string, string>; fallbackCharacterId?: string },
  ) => {
    const map =
      options?.characterMap && Object.keys(options.characterMap).length > 0
        ? options.characterMap
        : undefined;
    const preview = await previewImportDocument(document, {
      accountToken: account?.token,
      importAll: true,
      characterMap: map,
      fallbackCharacterId: options?.fallbackCharacterId,
    });
    setImportPreview(preview);
    // Default open picker to first successful row (keep user pick if still valid)
    setImportOpenIndex((prev) => {
      const ok = preview.sessions.filter((s) => s.ok);
      if (prev != null && ok.some((s) => s.index === prev)) return prev;
      return ok[0]?.index ?? null;
    });
    return preview;
  };

  const importChatFromFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setImportBusy(true);
    try {
      const text = await file.text();
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }

      const liveIds = new Set(characters.map((c) => c.id));
      liveIds.add("twink-default");
      liveIds.add("female-default");

      const refs = collectExportCharacters(document);
      const { missing } = partitionCharacters(refs, liveIds);
      const draft: Record<string, string> = {};
      for (const m of missing) {
        draft[m.id] = suggestFallbackId(m.name, liveIds);
      }
      const fb = liveIds.has("twink-default")
        ? "twink-default"
        : [...liveIds][0] ?? "twink-default";

      setImportDoc(document);
      setImportMissing(missing);
      setImportCharacterMap(draft);
      setImportFallbackId(fb);

      const preview = await loadChatImportPreview(document, {
        characterMap: Object.keys(draft).length ? draft : undefined,
        // Always offer a safety net for chat imports when anything is missing
        fallbackCharacterId: missing.length ? fb : undefined,
      });

      flashCopy(
        missing.length > 0
          ? `Preview: ${preview.willSucceed} ready · ${missing.length} need remap`
          : `Preview: ${preview.willSucceed} chat(s), ${preview.totalMessages} msgs — confirm to open`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import preview failed");
      clearImportDraft();
    } finally {
      setImportBusy(false);
    }
  };

  const onRefreshChatImportPreview = async () => {
    if (!importDoc) return;
    setImportBusy(true);
    setError(null);
    try {
      for (const m of importMissing) {
        if (!importCharacterMap[m.id]?.trim()) {
          setError(`Map a live character for “${m.name}”`);
          return;
        }
      }
      const preview = await loadChatImportPreview(importDoc, {
        characterMap: Object.keys(importCharacterMap).length
          ? importCharacterMap
          : undefined,
        fallbackCharacterId: importMissing.length ? importFallbackId : undefined,
      });
      flashCopy(
        `Preview updated: ${preview.willSucceed} will import, ${preview.willFail} blocked`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setImportBusy(false);
    }
  };

  const confirmChatImport = async () => {
    if (!importDoc) return;
    for (const m of importMissing) {
      if (!importCharacterMap[m.id]?.trim()) {
        setError(`Map a live character for “${m.name}”`);
        return;
      }
    }
    setImportBusy(true);
    setError(null);
    try {
      const opts = {
        characterMap: Object.keys(importCharacterMap).length
          ? importCharacterMap
          : undefined,
        fallbackCharacterId: importMissing.length ? importFallbackId : undefined,
      };
      const preview = await loadChatImportPreview(importDoc, opts);
      if (preview.willSucceed === 0) {
        setError("Nothing would import — fix remaps");
        setImportBusy(false);
        return;
      }

      clearSessionState();
      setStatus("connecting");
      const session = await importSessionDocument(importDoc, {
        accountToken: account?.token,
        importAll: true,
        characterMap: opts.characterMap,
        fallbackCharacterId: opts.fallbackCharacterId ?? "twink-default",
        openIndex: importOpenIndex ?? undefined,
      });
      clearImportDraft();
      await openLiveSession(session);
      const remapped =
        !!session.imported.remappedFrom ||
        !!session.bulk?.results.some((r) => r.ok && r.remappedFrom);
      flashCopy(
        `${importFlashSummary(session)}${session.imported.truncated ? " (trimmed)" : ""}${
          remapped ? " · remapped" : ""
        }`,
      );
      if (session.bulk && session.bulk.failed > 0) {
        setError(
          `${session.bulk.failed} chat(s) could not be restored (empty or unmapped)`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("error");
      setRestarting(false);
    } finally {
      setImportBusy(false);
    }
  };

  const resumeLastSession = async (storedOverride?: StoredSession) => {
    const stored = storedOverride ?? savedSession ?? loadStoredSession();
    if (!stored) {
      setError("No saved session on this device");
      return;
    }
    clearSessionState();
    try {
      await connectResumedSession(stored);
    } catch (err) {
      if (!storedOverride) {
        clearStoredSession();
        setSavedSession(null);
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not resume — start a new session",
      );
      setStatus("error");
    }
  };

  // Deep-links: ?magic=  ?character=  ?resume=  or legacy ?session=&token=
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;

    const query = parseShareQuery(window.location.search);

    if (query.magicToken) {
      deepLinkHandledRef.current = true;
      void (async () => {
        setAccountBusy(true);
        setError(null);
        try {
          const result = await verifyMagicLink(query.magicToken!);
          const stored: StoredAccount = {
            accountId: result.accountId,
            handle: result.handle,
            token: result.token,
            expiresAt: result.expiresAt,
            savedAt: new Date().toISOString(),
          };
          saveStoredAccount(stored);
          setAccount(stored);
          setShowAccount(true);
          await refreshAccountSessions(stored.token);
          flashCopy(`Signed in as @${result.handle}`);
          replaceCharacterInUrl(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Magic link failed");
          setShowAccount(true);
        } finally {
          setAccountBusy(false);
        }
      })();
      return;
    }

    if (characters.length === 0) return;
    if (!query.characterId && !query.resumeCode && !(query.sessionId && query.token)) return;

    deepLinkHandledRef.current = true;

    if (query.resumeCode) {
      void (async () => {
        try {
          setStatus("connecting");
          const session = await resumeByCode(query.resumeCode!);
          await openLiveSession(session, {
            forceRehydrate: query.rehydrate !== false,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Invalid resume code");
          setStatus("error");
        }
      })();
      return;
    }

    if (query.sessionId && query.token) {
      const stored: StoredSession = {
        sessionId: query.sessionId,
        wsToken: query.token,
        characterId: query.characterId ?? "twink-default",
        savedAt: new Date().toISOString(),
      };
      void resumeLastSession(stored);
      return;
    }

    if (query.characterId) {
      const exists = characters.some((c) => c.id === query.characterId);
      if (!exists) {
        setError(
          `Unknown character “${query.characterId}” — it may be a custom model not on this server.`,
        );
        return;
      }
      setCharacter(query.characterId);
      // Deep-link mode=edge_pace must apply before createSession (state alone is too late).
      if (query.sessionMode) {
        setSessionMode(query.sessionMode);
      }
      if (query.autostart) {
        void startSession(
          query.characterId,
          query.sessionMode ? { sessionMode: query.sessionMode } : undefined,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once when catalog ready
  }, [characters]);

  const flashCopy = (label: string) => {
    setCopyNotice(label);
    window.setTimeout(() => setCopyNotice(null), 2200);
  };

  const shareCharacterLink = async (autostart = false) => {
    const url = buildCharacterShareUrl(character, { autostart, card: !autostart });
    const live = characters.find((c) => c.id === character);
    const name = live?.displayName ?? characterName ?? character;
    const opening = live?.openingMessage?.trim();
    const quote =
      opening && opening.length > 140 ? `${opening.slice(0, 137).trim()}…` : opening;
    const result = await shareOrCopyUrl({
      url,
      title: `${name} · Naughty Syntax`,
      text: quote
        ? `${name}: “${quote}” — live on Procharacters.cloud`
        : autostart
          ? `Chat with ${name} on Procharacters.cloud`
          : `Meet ${name} on Procharacters.cloud`,
    });
    const label = shareUrlResultLabel(
      result,
      autostart ? "Autostart link" : "Character card",
    );
    if (label) flashCopy(label);
  };

  const sharePrivateResumeLink = async () => {
    if (!resumeCode) {
      setError("Start or resume a session first — resume code not ready yet");
      return;
    }
    const url = buildResumeCodeShareUrl(resumeCode, {
      characterId: activeCharacterId ?? character,
    });
    const result = await shareOrCopyUrl({
      url,
      title: "Resume Procharacters chat",
      text: `Continue your chat (code ${resumeCode})`,
    });
    const label = shareUrlResultLabel(result, `Resume ${resumeCode}`);
    if (label) flashCopy(label);
  };

  const exportChat = async (format: "json" | "md" = "json") => {
    if (!sessionId || !wsToken) {
      setError("Start a session before exporting");
      return;
    }
    try {
      const result = await exportLiveSession(sessionId, wsToken, format);
      if (format === "md") {
        flashCopy(`Markdown → ${result.filename}`);
      } else {
        flashCopy(`Exported ${result.doc?.session.messageCount ?? "?"} msgs → ${result.filename}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const shareChatMarkdown = async () => {
    const safeName = (characterName ?? character ?? "chat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const day = new Date().toISOString().slice(0, 10);
    const filename = `procharacters-${safeName || "chat"}-${day}.md`;
    const title = `Chat with ${characterName ?? character ?? "character"}`;

    const deliver = async (markdown: string, kind: string) => {
      const result = await shareOrCopyText({ title, text: markdown, filename });
      const label = shareResultLabel(result, kind);
      if (label) flashCopy(label);
    };

    try {
      let markdown: string;
      if (sessionId && wsToken) {
        markdown = await fetchLiveSessionMarkdown(sessionId, wsToken);
      } else if (messages.length > 0) {
        const { buildLocalTranscriptMarkdown } = await import("@/lib/transcript-md");
        markdown = buildLocalTranscriptMarkdown({
          characterName: characterName ?? character,
          characterId: activeCharacterId ?? character,
          sessionId,
          resumeCode,
          messages: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        });
      } else {
        setError("Nothing to share yet — start chatting first");
        return;
      }
      await deliver(markdown, "Transcript");
    } catch (err) {
      // Fallback: build from local messages if server export fails mid-stream
      if (messages.length > 0) {
        try {
          const { buildLocalTranscriptMarkdown } = await import("@/lib/transcript-md");
          const markdown = buildLocalTranscriptMarkdown({
            characterName: characterName ?? character,
            characterId: activeCharacterId ?? character,
            sessionId,
            resumeCode,
            messages: messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              })),
          });
          await deliver(markdown, "Transcript");
          return;
        } catch {
          /* fall through */
        }
      }
      setError(err instanceof Error ? err.message : "Share transcript failed");
    }
  };

  const applyAccountAuth = async (result: {
    accountId: string;
    handle: string;
    token: string;
    expiresAt: string;
  }, label: string) => {
    const stored: StoredAccount = {
      accountId: result.accountId,
      handle: result.handle,
      token: result.token,
      expiresAt: result.expiresAt,
      savedAt: new Date().toISOString(),
    };
    saveStoredAccount(stored);
    setAccount(stored);
    setAccountPass("");
    setMagicDevLink(null);
    await refreshAccountSessions(stored.token);
    if (sessionId) {
      try {
        const claimed = await claimSession(stored.token, sessionId);
        if (claimed.resumeCode) {
          setResumeCode(claimed.resumeCode);
          rememberSession({
            sessionId,
            wsToken: wsToken ?? "",
            characterId: activeCharacterId ?? character,
            characterName,
            resumeCode: claimed.resumeCode,
          });
        }
        // Refresh so list + resume cache pick up the claimed session
        await refreshAccountSessions(stored.token);
      } catch {
        /* optional claim */
      }
    }
    flashCopy(label);
  };

  const handleAccountAuth = async (mode: "login" | "register") => {
    setAccountBusy(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await registerAccount(accountHandle.trim(), accountPass)
          : await loginAccount(accountHandle.trim(), accountPass);
      await applyAccountAuth(
        result,
        mode === "register" ? "Account created" : `Signed in as ${result.handle}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account auth failed");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleMagicRequest = async () => {
    setAccountBusy(true);
    setError(null);
    setMagicDevLink(null);
    try {
      const result = await requestMagicLink(accountEmail.trim());
      if (result.magicUrl) {
        setMagicDevLink(result.magicUrl);
        flashCopy(result.delivered ? "Email sent" : "Magic link ready (open below)");
      } else {
        flashCopy(result.delivered ? "Check your email" : "Request sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Magic link failed");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleLinkEmail = async () => {
    if (!account) return;
    setAccountBusy(true);
    setError(null);
    setMagicDevLink(null);
    try {
      const result = await linkEmailToAccount(account.token, accountEmail.trim());
      if (result.magicUrl) {
        setMagicDevLink(result.magicUrl);
        flashCopy("Confirm email link ready");
      } else {
        flashCopy(result.delivered ? "Check your email to confirm" : "Link request sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link email");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleAccountLogout = async () => {
    if (account) {
      try {
        await logoutAccount(account.token);
      } catch {
        /* ignore */
      }
    }
    clearStoredAccount();
    setAccount(null);
    setAccountSessions([]);
    flashCopy("Signed out");
  };

  const handleResumeCodeSubmit = async () => {
    const code = resumeCodeInput.trim();
    if (code.length < 6) {
      setError("Enter a valid resume code");
      return;
    }
    clearSessionState();
    try {
      setStatus("connecting");
      const session = await resumeByCode(code);
      await openLiveSession(session, { forceRehydrate: true });
      setResumeCodeInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume code failed");
      setStatus("error");
    }
  };

  const handleAccountSessionResume = async (sessionIdToResume: string) => {
    if (!account) return;
    clearSessionState();
    try {
      setStatus("connecting");
      const session = await resumeAccountSession(account.token, sessionIdToResume);
      await openLiveSession(session, { forceRehydrate: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume account session");
      setStatus("error");
    }
  };

  const startNewSession = async () => {
    setRestarting(true);
    setError(null);
    intentionalCloseRef.current = true;
    setConnectionDropped(false);
    closeSocket(true);
    clearSessionState();
    try {
      await connectSession(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start new session");
      setStatus("error");
      setRestarting(false);
    }
  };

  const rejoinAfterDrop = useCallback(async () => {
    setConnectionDropped(false);
    setError(null);
    setRestarting(true);
    try {
      const code =
        resumeCode ??
        savedSession?.resumeCode ??
        liveCredsRef.current?.resumeCode ??
        null;
      if (code) {
        setStatus("connecting");
        const session = await resumeByCode(code);
        await openLiveSession(session);
        return;
      }
      const stored: StoredSession | null =
        sessionId && wsToken
          ? {
              sessionId,
              wsToken,
              characterId: activeCharacterId ?? character,
              characterName: characterName ?? undefined,
              resumeCode: resumeCode ?? undefined,
              savedAt: new Date().toISOString(),
            }
          : savedSession ??
            (liveCredsRef.current
              ? {
                  sessionId: liveCredsRef.current.sessionId,
                  wsToken: liveCredsRef.current.wsToken,
                  characterId: liveCredsRef.current.characterId,
                  characterName:
                    liveCredsRef.current.characterName ?? undefined,
                  resumeCode: liveCredsRef.current.resumeCode ?? undefined,
                  savedAt: new Date().toISOString(),
                }
              : null);
      if (stored) {
        await connectResumedSession(stored);
        return;
      }
      throw new Error("Nothing to rejoin — start a new session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejoin failed");
      setStatus("error");
      setConnectionDropped(true);
    } finally {
      setRestarting(false);
    }
  }, [
    activeCharacterId,
    character,
    characterName,
    connectResumedSession,
    openLiveSession,
    resumeCode,
    savedSession,
    sessionId,
    wsToken,
  ]);

  const buildMediaOverrides = () => {
    const mediaOverrides: {
      idle?: string;
      teasing?: string;
      playful?: string;
      aroused?: string;
    } = {};
    if (clipIdle.trim()) mediaOverrides.idle = clipIdle.trim();
    if (clipTeasing.trim()) mediaOverrides.teasing = clipTeasing.trim();
    if (clipPlayful.trim()) mediaOverrides.playful = clipPlayful.trim();
    if (clipAroused.trim()) mediaOverrides.aroused = clipAroused.trim();
    return Object.keys(mediaOverrides).length > 0 ? mediaOverrides : undefined;
  };

  const handleCreateCustom = async () => {
    if (!account?.token) {
      setError("Sign in to save a My Character (private)");
      setShowAccount(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const keyPhrases = [customPhrase1, customPhrase2, customPhrase3]
        .map((p) => p.trim())
        .filter((p) => p.length >= 2);
      const scenes = [
        { title: customScene1Title, body: customScene1Body },
        { title: customScene2Title, body: customScene2Body },
        { title: customScene3Title, body: customScene3Body },
      ]
        .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
        .filter((s) => s.title.length >= 2 && s.body.length >= 12);

      const created = await createCustomCharacter(
        {
          name: customName.trim(),
          appearance: customAppearance.trim(),
          energy: customEnergy.trim() || undefined,
          clothing: customClothing.trim() || undefined,
          baseModelId: customBaseModel,
          avatarBase: customBase,
          audience: customBase === "female-default" ? "straight" : "gay",
          keyPhrases: keyPhrases.length ? keyPhrases : undefined,
          scenes: scenes.length ? scenes : undefined,
          mediaBase: mediaBase.trim() || undefined,
          mediaOverrides: buildMediaOverrides(),
        },
        account.token,
      );
      const option: LiveCharacterOption = {
        id: created.id,
        displayName: created.displayName,
        defaultVersion: created.defaultVersion,
        kind: "custom",
        avatarBase: created.avatarBase,
        energyLabel: created.energyLabel,
        mediaBase: created.mediaBase,
        mediaOverrides: created.mediaOverrides,
        clips: created.clips,
      };
      setCharacters((prev) => {
        if (prev.some((c) => c.id === option.id)) return prev;
        return [...prev, option];
      });
      setCharacter(created.id);
      replaceCharacterInUrl(created.id);
      setShowCreate(false);
      setCustomName("");
      setCustomAppearance("");
      setCustomEnergy("");
      setCustomClothing("");
      setCustomPhrase1("");
      setCustomPhrase2("");
      setCustomPhrase3("");
      setCustomScene1Title("");
      setCustomScene1Body("");
      setCustomScene2Title("");
      setCustomScene2Body("");
      setCustomScene3Title("");
      setCustomScene3Body("");
      setMediaBase("");
      setClipIdle("");
      setClipTeasing("");
      setClipPlayful("");
      setClipAroused("");
      setShowMediaAdvanced(false);
      flashCopy("My Character saved (private) — ready to chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create My Character");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveMediaForSelected = async () => {
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") {
      setError("Select a custom character to update clips");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const updated = await updateCustomCharacter(selected.id, {
        mediaBase: mediaBase.trim() ? mediaBase.trim() : null,
        mediaOverrides: buildMediaOverrides() ?? null,
      });
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                mediaBase: updated.mediaBase,
                mediaOverrides: updated.mediaOverrides,
                clips: updated.clips,
              }
            : c,
        ),
      );
      flashCopy("Clip pack updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update clips");
    } finally {
      setCreating(false);
    }
  };

  const applyClipResult = (
    selectedId: string,
    mediaOverrides?: { idle?: string; teasing?: string; playful?: string; aroused?: string },
    clips?: LiveCharacterOption["clips"],
  ) => {
    if (mediaOverrides?.idle) setClipIdle(mediaOverrides.idle);
    if (mediaOverrides?.teasing) setClipTeasing(mediaOverrides.teasing);
    if (mediaOverrides?.playful) setClipPlayful(mediaOverrides.playful);
    if (mediaOverrides?.aroused) setClipAroused(mediaOverrides.aroused);
    setCharacters((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              mediaOverrides: mediaOverrides ?? c.mediaOverrides,
              clips: clips ?? c.clips,
            }
          : c,
      ),
    );
  };

  const handleUploadClip = async (emotion: MediaClipKey, file: File | null) => {
    if (!file) return;
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") {
      setError("Select a custom character before uploading clips");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await uploadCharacterClip(selected.id, emotion, file);
      applyClipResult(selected.id, result.mediaOverrides, result.clips);
      flashCopy(`Uploaded ${emotion} clip`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCreating(false);
    }
  };

  const handleBatchUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") {
      setError("Select a custom character before uploading clips");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const files = Array.from(fileList);
      const result = await uploadCharacterClipsBatch(selected.id, files);
      applyClipResult(selected.id, result.mediaOverrides, result.clips);
      const n = result.uploaded.length;
      const skip = result.skipped.length;
      flashCopy(
        skip > 0
          ? `Uploaded ${n} clip(s), skipped ${skip}`
          : `Uploaded ${n} clip(s)`,
      );
      if (skip > 0) {
        setError(
          result.skipped.map((s) => `${s.filename}: ${s.reason}`).join(" · "),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch upload failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCustom = async () => {
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") return;
    if (!window.confirm(`Delete custom character “${selected.displayName}”?`)) return;

    setError(null);
    try {
      await deleteCustomCharacter(selected.id, account?.token);
      setCharacters((prev) => prev.filter((c) => c.id !== selected.id));
      setCharacter("twink-default");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete character");
    }
  };

  const sendMessage = (overrideText?: string) => {
    const ws = wsRef.current;
    const text = (overrideText ?? input).trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text || sending) return;

    setSendPulse(true);
    window.setTimeout(() => setSendPulse(false), 420);

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    clearComposerDraft(character);
    setSending(true);
    setIsTyping(true);

    ws.send(JSON.stringify({ type: "user_message", content: text }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sessionActive = status === "ready" || status === "connecting" || restarting;
  const canSend = status === "ready" && !sending && input.trim().length > 0;
  const selectedLive =
    characters.find((c) => c.id === (activeCharacterId ?? character)) ??
    characters.find((c) => c.id === character) ??
    null;
  const headerCharacterName =
    characterName ??
    savedSession?.characterName ??
    selectedLive?.displayName ??
    null;
  const headerMind = mindFingerprint(activeCharacterId ?? character);
  const selectedOpening =
    selectedLive?.openingMessage?.trim() ||
    FALLBACK_CHARACTERS.find((c) => c.id === (activeCharacterId ?? character))
      ?.openingMessage ||
    null;
  const chatPresenceSkin = resolvePresenceSkin(
    avatarState?.presenceSkin,
    activeCharacterId ?? character,
  );
  const assistantBubbleClass = presenceBubbleClass(chatPresenceSkin);
  const transcriptAmbient = presenceAmbientClass(chatPresenceSkin);

  const onMessagesScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist < 80;
    setStickToBottom(nearBottom);
    if (nearBottom) setShowJumpLatest(false);
  };

  const jumpToLatest = () => {
    setStickToBottom(true);
    setShowJumpLatest(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const statusLabel =
    status === "ready"
      ? headerCharacterName
        ? `Live · ${headerCharacterName}`
        : "Connected"
      : status === "connecting" || restarting
        ? headerCharacterName
          ? `Opening ${headerCharacterName}…`
          : "Connecting…"
        : status === "ended"
          ? "Session ended"
          : status === "error"
            ? "Error"
            : "Disconnected";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(225,29,143,0.08),transparent_40%)]" />

      {/* Sticky glass top chrome */}
      <header className="glass-bar sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">
              Naughty Syntax
              {headerMind ? ` · ${headerMind.tag}` : ""}
            </p>
            <h1 className="truncate bg-gradient-to-r from-brand-text to-brand-accent bg-clip-text text-base font-semibold tracking-tight text-transparent sm:text-xl">
              {headerCharacterName ? `Chat · ${headerCharacterName}` : "Live chat"}
            </h1>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-brand-border bg-brand-panel/80 px-2.5 py-1 text-[11px] text-brand-muted sm:inline-flex">
            <StatusDot status={status} />
            {statusLabel}
          </span>
          <span className="hidden sm:inline-flex">
            <LiveKitBadge roomStatus={livekitRoomStatus} compact />
          </span>
          {copyNotice && (
            <span className="hidden max-w-[10rem] truncate text-[11px] text-brand-accent sm:inline" role="status">
              {copyNotice}
            </span>
          )}
          <a href="/" className="btn-ghost min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm">
            Gallery
          </a>
          <a href="/account" className="btn-ghost min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm">
            Settings
          </a>
          <button
            type="button"
            onClick={() => setShowAccount((v) => !v)}
            className={`btn-ghost min-h-0 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm ${
              showAccount ? "border-brand-accent text-brand-accent" : ""
            }`}
          >
            {account ? `@${account.handle}` : "Account"}
          </button>
        </div>
        {copyNotice && (
          <p className="border-t border-brand-border/50 px-3 py-1 text-center text-[11px] text-brand-accent sm:hidden" role="status">
            {copyNotice}
          </p>
        )}
      </header>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pt-3 sm:px-4 sm:pt-5">
        <SessionAuthBanner
          className="mb-3"
          onInvalidated={() => {
            setAccount(null);
            setAccountSessions([]);
            setAccountEmailLinked(null);
          }}
        />
        <InstallAppHint className="mb-3" />
        <SoftSupportHint
          className="mb-3"
          hasEngagement={
            messages.length >= 4 || !!resumeCode || !!savedSession?.resumeCode
          }
        />
        {pauseSnapshot && status === "idle" && (
          <SessionPausedBanner
            characterId={pauseSnapshot.characterId}
            characterName={pauseSnapshot.characterName}
            resumeCode={pauseSnapshot.resumeCode}
            messageCount={pauseSnapshot.messageCount}
            onResume={() => {
              const snap = pauseSnapshot;
              setPauseSnapshot(null);
              setCharacter(snap.characterId);
              void resumeLastSession().catch(() => {
                void startSession();
              });
            }}
            onDismiss={() => setPauseSnapshot(null)}
          />
        )}
        <SessionDropRescue
          className="mb-3"
          show={connectionDropped}
          resumeCode={
            resumeCode ??
            savedSession?.resumeCode ??
            liveCredsRef.current?.resumeCode ??
            null
          }
          characterName={
            characterName ?? savedSession?.characterName ?? null
          }
          characterId={activeCharacterId ?? character}
          busy={restarting}
          onRejoin={() => void rejoinAfterDrop()}
          onDismiss={() => setConnectionDropped(false)}
        />
        {showAccount && (
          <div className="mb-3 rounded-xl border border-brand-border bg-brand-panel/95 p-3 shadow-card backdrop-blur-sm animate-fade-in">
            {account ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-brand-text">
                    Signed in as <strong>@{account.handle}</strong>
                    {accountEmailLinked && (
                      <span className="ml-2 text-xs text-brand-muted">· {accountEmailLinked}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleAccountLogout}
                    className="rounded-lg border border-brand-border px-3 py-1 text-xs hover:border-brand-accent"
                  >
                    Sign out
                  </button>
                  <button
                    type="button"
                    onClick={() => account && void refreshAccountSessions(account.token)}
                    className="rounded-lg border border-brand-border px-3 py-1 text-xs hover:border-brand-accent"
                  >
                    Refresh chats
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder={
                      accountEmailLinked
                        ? "Change linked email"
                        : "Link email for magic sign-in"
                    }
                    className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                  />
                  <button
                    type="button"
                    disabled={accountBusy || !accountEmail.includes("@")}
                    onClick={() => void handleLinkEmail()}
                    className="rounded-lg border border-brand-accent/50 px-3 py-2 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
                  >
                    {accountEmailLinked ? "Update email" : "Link email"}
                  </button>
                </div>
                {magicDevLink && (
                  <div className="rounded-lg border border-brand-accent/40 bg-brand-bg p-2 text-xs">
                    <p className="text-brand-muted">Confirm link (open to attach email):</p>
                    <a
                      href={magicDevLink}
                      className="mt-1 block break-all text-brand-accent hover:underline"
                    >
                      {magicDevLink}
                    </a>
                  </div>
                )}
                {accountSessions.length === 0 ? (
                  <p className="text-xs text-brand-muted">
                    No saved chats on this account yet. Start a session while signed in.
                  </p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {accountSessions.map((s) => (
                      <li
                        key={s.sessionId}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-border/60 bg-brand-bg px-2 py-1.5"
                      >
                        <span className="text-brand-text">
                          {s.characterName} · {s.messageCount} msgs · {s.status}
                        </span>
                        {s.resumeCode && (
                          <span className="font-mono text-brand-muted">{s.resumeCode}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleAccountSessionResume(s.sessionId)}
                          className="ml-auto text-brand-accent hover:underline"
                        >
                          Resume
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="Email for magic link"
                    className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                  />
                  <button
                    type="button"
                    disabled={accountBusy || !accountEmail.includes("@")}
                    onClick={() => void handleMagicRequest()}
                    className="rounded-lg bg-brand-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {accountBusy ? "Sending…" : "Email magic link"}
                  </button>
                </div>
                {magicDevLink && (
                  <div className="rounded-lg border border-brand-accent/40 bg-brand-bg p-2 text-xs">
                    <p className="text-brand-muted">
                      Email provider not configured — open this link to sign in:
                    </p>
                    <a
                      href={magicDevLink}
                      className="mt-1 block break-all text-brand-accent hover:underline"
                    >
                      {magicDevLink}
                    </a>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <input
                    value={accountHandle}
                    onChange={(e) => setAccountHandle(e.target.value)}
                    placeholder="Handle (optional)"
                    className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                  />
                  <input
                    type="password"
                    value={accountPass}
                    onChange={(e) => setAccountPass(e.target.value)}
                    placeholder="Passphrase (6+)"
                    className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                  />
                  <button
                    type="button"
                    disabled={
                      accountBusy || accountHandle.trim().length < 3 || accountPass.length < 6
                    }
                    onClick={() => void handleAccountAuth("login")}
                    className="rounded-lg border border-brand-border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    disabled={
                      accountBusy || accountHandle.trim().length < 3 || accountPass.length < 6
                    }
                    onClick={() => void handleAccountAuth("register")}
                    className="rounded-lg border border-brand-border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Register
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={resumeCodeInput}
                onChange={(e) => setResumeCodeInput(e.target.value.toUpperCase())}
                placeholder="Resume code (e.g. AB3K9MPQ)"
                className="min-w-[12rem] flex-1 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 font-mono text-sm text-brand-text"
              />
              <button
                type="button"
                onClick={() => void handleResumeCodeSubmit()}
                className="rounded-lg border border-brand-accent/50 px-3 py-2 text-sm text-brand-text hover:border-brand-accent"
              >
                Open code
              </button>
            </div>
            <p className="mt-2 text-[11px] text-brand-muted">
              Prefer email magic link for multi-device sign-in. Passphrase still works. Resume codes
              share chats without raw tokens.
            </p>
          </div>
        )}

        {error && (
          <div
            className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 animate-fade-in"
            role="alert"
          >
            {error}
          </div>
        )}

        {importDoc != null && importPreview && (
          <div className="mb-3">
            <ImportPreviewPanel
              preview={importPreview}
              missing={importMissing}
              characterMap={importCharacterMap}
              onCharacterMapChange={setImportCharacterMap}
              fallbackId={importFallbackId}
              onFallbackChange={setImportFallbackId}
              liveCharacters={characters}
              busy={importBusy}
              confirmLabel={`Open import (${importPreview.willSucceed})`}
              onRefreshPreview={() => void onRefreshChatImportPreview()}
              onConfirm={() => void confirmChatImport()}
              onCancel={clearImportDraft}
              showOpenPicker
              openIndex={importOpenIndex}
              onOpenIndexChange={setImportOpenIndex}
            />
          </div>
        )}

        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 pb-3 lg:gap-4 ${
            avatarCollapsed ? "lg:flex-col" : "lg:flex-row"
          }`}
        >
          {/* LiveKit stays mounted even when collapsed so avatar state keeps syncing */}
          <div className="sr-only" aria-hidden>
            <LiveKitAvatarSync
              livekit={livekit}
              onAvatarSync={handleAvatarSync}
              onStatusChange={setLivekitRoomStatus}
            />
          </div>

          {avatarCollapsed ? (
            <div className="flex w-full shrink-0 items-center gap-2 rounded-xl border border-brand-border bg-brand-panel/95 px-2.5 py-2 shadow-card backdrop-blur-sm">
              <div
                className={`avatar-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${
                  avatarState
                    ? "from-brand-accentDim to-brand-accent"
                    : "from-brand-border to-brand-accentDim"
                }`}
              >
                {(characterName ?? "?").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-text">
                  {characterName ?? headerCharacterName ?? "Avatar hidden"}
                </p>
                <p className="truncate text-[11px] text-brand-muted">
                  {avatarState
                    ? `${avatarState.emotion.replace(/_/g, " ")} · ${Math.round((avatarState.arousalLevel ?? 0) * 100)}%`
                    : headerMind
                      ? `Mind · ${headerMind.tag}`
                      : "Video collapsed for more chat space"}
                  {avatarPip ? " · PiP on" : " · PiP off"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarPipPersist(!avatarPip)}
                className="btn-ghost min-h-0 shrink-0 px-2.5 py-1.5 text-xs"
                title={avatarPip ? "Hide floating mini avatar" : "Show floating mini avatar"}
              >
                {avatarPip ? "PiP off" : "PiP on"}
              </button>
              <button
                type="button"
                onClick={() => setAvatarCollapsedPersist(false)}
                className="btn-ghost min-h-0 shrink-0 px-3 py-1.5 text-xs"
                title="Show avatar video and status"
              >
                Expand
              </button>
            </div>
          ) : (
            <div className="flex w-full shrink-0 flex-col gap-2 sm:gap-3 lg:max-w-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted">Avatar</p>
                <button
                  type="button"
                  onClick={() => setAvatarCollapsedPersist(true)}
                  className="text-[11px] text-brand-muted transition hover:text-brand-accent"
                  title="Hide avatar for more chat space"
                >
                  Hide · more chat
                </button>
              </div>
              <div className="flex flex-row gap-2 sm:gap-3 lg:flex-col">
                <div className="w-[42%] shrink-0 sm:w-1/3 lg:w-full">
                  <AvatarVideo
                    avatar={avatarState}
                    characterName={characterName}
                    characterId={activeCharacterId ?? character}
                    compact
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2 lg:space-y-3">
                  <AvatarPanel
                    characterName={characterName}
                    characterId={activeCharacterId}
                    avatar={avatarState}
                    status={status}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section className="mb-3 flex flex-col gap-2 rounded-xl border border-brand-border bg-brand-panel/95 p-2.5 shadow-card backdrop-blur-sm sm:mb-4 sm:gap-3 sm:p-4">
            {!sessionActive && savedSession && !pauseSnapshot && (
              <ChatResumeHero
                saved={savedSession}
                busy={restarting}
                onResume={() => void resumeLastSession()}
                onStartFresh={() => {
                  setCharacter(savedSession.characterId);
                  void startSession();
                }}
              />
            )}
            {!sessionActive && sessionMode === "edge_pace" && (
              <EdgePaceStartHint
                characterId={character}
                characterName={
                  characters.find((c) => c.id === character)?.displayName ?? headerCharacterName
                }
                busy={restarting}
                onStart={() => void startSession(character, { sessionMode: "edge_pace" })}
              />
            )}
            {!sessionActive && input.trim().length >= 8 && (
              <DraftRecoveryHint
                characterId={character}
                characterName={
                  characters.find((c) => c.id === character)?.displayName ?? null
                }
                draftPreview={input.trim()}
                onClear={() => {
                  setInput("");
                  clearComposerDraft(character);
                }}
              />
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
              <label className="shrink-0 text-xs text-brand-muted sm:text-sm" htmlFor="character">
                Character
              </label>
              <select
                id="character"
                value={character}
                onChange={(e) => {
                  const next = e.target.value as CharacterId;
                  setCharacter(next);
                  replaceCharacterInUrl(next);
                }}
                disabled={status === "connecting" || restarting}
                className="field min-h-touch min-w-0 flex-1 text-sm disabled:opacity-50"
              >
                {characters.map((opt) => {
                  const mind = mindFingerprint(opt.id);
                  return (
                  <option key={opt.id} value={opt.id}>
                    {opt.kind === "custom" ? "✦ " : ""}
                    {opt.displayName}
                    {mind ? ` · ${mind.tag}` : ""}
                    {opt.defaultVersion ? ` (${opt.defaultVersion})` : ""}
                  </option>
                  );
                })}
              </select>
              </div>
              {headerMind && !sessionActive && (
                <p className="pl-0 text-[10px] leading-snug text-brand-muted sm:pl-[4.5rem]">
                  <span className="font-semibold text-brand-accent">Mind · {headerMind.tag}</span>
                  {" · "}
                  {headerMind.blurb}
                </p>
              )}
              </div>

              {!sessionActive && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-muted">
                  <label className="flex items-center gap-1.5">
                    Mode
                    <select
                      value={sessionMode}
                      onChange={(e) => setSessionMode(e.target.value as SessionMode)}
                      className={`field min-h-0 py-1 text-xs ${
                        sessionMode === "edge_pace"
                          ? "border-rose-400/50 text-rose-100"
                          : ""
                      }`}
                      title="Phase 10 preview — Edge Pace adds soft timers + denial coaching"
                    >
                      <option value="normal">Normal</option>
                      <option value="edge_pace">Edge Pace</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    Memory window
                    <select
                      value={messageWindow}
                      onChange={(e) =>
                        setMessageWindow(Number(e.target.value) as 20 | 30 | 50 | 80)
                      }
                      className="field min-h-0 py-1 text-xs"
                    >
                      <option value={20}>20 msgs</option>
                      <option value={30}>30 msgs</option>
                      <option value={50}>50 msgs</option>
                      <option value={80}>80 msgs</option>
                    </select>
                  </label>
                  {account && (
                    <>
                      <label
                        className="flex cursor-pointer items-center gap-1.5"
                        title="Saves vibe + wants for this character when signed in. Uncheck anytime; Forget me clears it."
                      >
                        <input
                          type="checkbox"
                          checked={crossSessionOptIn}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setCrossSessionOptIn(next);
                            if (!next) setPriorNotes(null);
                            void setCrossSessionMemoryOptIn(account.token, character, next).catch(
                              () => {
                                /* ignore */
                              },
                            );
                          }}
                        />
                        Remember me (sticky heat)
                      </label>
                      {(crossSessionOptIn || priorNotes) && (
                        <button
                          type="button"
                          className="text-[11px] text-violet-200/90 underline-offset-2 hover:underline"
                          title="Clear long-term dossier for this character"
                          onClick={() => {
                            void clearCrossSessionMemory(account.token, character)
                              .then((r) => {
                                setPriorNotes(null);
                                if (!r.optIn) setCrossSessionOptIn(false);
                                flashCopy("Forgot this character’s memory");
                              })
                              .catch(() => flashCopy("Could not clear memory"));
                          }}
                        >
                          Forget me
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="scroll-strip -mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5">
              {!sessionActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className={`min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm ${
                      savedSession ? "btn-ghost" : "btn-primary"
                    }`}
                  >
                    {savedSession ? "Start new" : "Start"}
                  </button>
                  {savedSession && !pauseSnapshot && (
                    <button
                      type="button"
                      onClick={() => void resumeLastSession()}
                      className="btn-primary min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                      title={`Resume ${savedSession.characterName ?? savedSession.characterId}`}
                    >
                      Resume
                    </button>
                  )}
                  <label
                    className={`btn-ghost min-h-0 shrink-0 cursor-pointer px-3 py-2 text-xs sm:text-sm ${
                      importBusy ? "opacity-50" : ""
                    }`}
                    title="Preview then restore exported chat JSON"
                  >
                    {importBusy ? "…" : "Import"}
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      disabled={importBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void importChatFromFile(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreate((v) => !v)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                  >
                    {showCreate ? "Close" : "Create"}
                  </button>
                  {characters.some((c) => c.id === character && c.kind === "custom") && (
                    <button
                      type="button"
                      onClick={handleDeleteCustom}
                      className="btn-ghost min-h-0 shrink-0 border-red-500/40 px-3 py-2 text-xs text-red-300 sm:text-sm"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void shareCharacterLink(false)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                    title={
                      canNativeShare()
                        ? "Share character card via system sheet"
                        : "Copy character card link"
                    }
                  >
                    {canNativeShare() ? "Share card" : "Copy card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareCharacterLink(true)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                    title={
                      canNativeShare()
                        ? "Share autostart chat link"
                        : "Copy autostart chat link"
                    }
                  >
                    {canNativeShare() ? "Share chat" : "Copy ▶"}
                  </button>
                  <a
                    href={`/character/${encodeURIComponent(character)}`}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs text-brand-muted sm:text-sm"
                  >
                    Card
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startNewSession}
                    disabled={status === "connecting" || restarting}
                    className="btn-primary min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                  >
                    {restarting ? "…" : "Switch"}
                  </button>
                  <button
                    type="button"
                    onClick={endSession}
                    disabled={status === "connecting" || restarting}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                  >
                    End
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareCharacterLink(true)}
                    disabled={status === "connecting" || restarting}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title={
                      canNativeShare()
                        ? "Share public character link"
                        : "Copy public character link"
                    }
                  >
                    {canNativeShare() ? "Share" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sharePrivateResumeLink()}
                    disabled={status !== "ready" || !resumeCode}
                    className="btn-ghost min-h-0 shrink-0 border-amber-500/40 px-3 py-2 text-xs text-amber-200 disabled:opacity-50 sm:text-sm"
                    title={
                      canNativeShare()
                        ? "Share resume code link"
                        : "Copy resume code link"
                    }
                  >
                    {resumeCode ? `Resume ${resumeCode}` : "Resume code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportChat("json")}
                    disabled={!sessionId || !wsToken || messages.length === 0}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title="Download chat history as JSON (no secrets)"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportChat("md")}
                    disabled={!sessionId || !wsToken || messages.length === 0}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title="Download chat history as Markdown"
                  >
                    MD
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareChatMarkdown()}
                    disabled={messages.length === 0 && !(sessionId && wsToken)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title={
                      canNativeShare()
                        ? "Share Markdown via system share sheet"
                        : "Copy Markdown transcript to clipboard"
                    }
                  >
                    {canNativeShare() ? "Share MD" : "Copy MD"}
                  </button>
                </>
              )}
              </div>
            </div>

            {showCreate && !sessionActive && (
              <div className="grid gap-2 rounded-lg border border-brand-border bg-brand-bg p-3">
                <p className="text-xs text-brand-muted">
                  <strong className="text-brand-text">My Character (v2)</strong> — private to your
                  account. Pick a base model (prefill identity/vibe), add phrases + 2–3 scenes, save.
                  {!account ? " Sign in required." : " Soft cap: 10 per account."}
                </p>
                <label className="text-[11px] text-brand-muted" htmlFor="baseModel">
                  Base model
                </label>
                <select
                  id="baseModel"
                  value={customBaseModel}
                  onChange={(e) => {
                    setCustomBaseModel(e.target.value);
                    // Force re-prefill by clearing soft fields when switching base
                    setCustomAppearance("");
                    setCustomEnergy("");
                    setCustomClothing("");
                  }}
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                >
                  {characters
                    .filter((c) => c.kind === "default")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                        {c.energyLabel ? ` — ${c.energyLabel.slice(0, 40)}` : ""}
                      </option>
                    ))}
                </select>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name (e.g. Diego)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <textarea
                  value={customAppearance}
                  onChange={(e) => setCustomAppearance(e.target.value)}
                  placeholder="Core identity / appearance lock (prefilled from base — edit me)"
                  rows={3}
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <input
                  value={customEnergy}
                  onChange={(e) => setCustomEnergy(e.target.value)}
                  placeholder="Vibe / energy (prefilled — edit me)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <input
                  value={customClothing}
                  onChange={(e) => setCustomClothing(e.target.value)}
                  placeholder="Clothing focus (sheer / crotchless — prefilled)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <p className="text-[11px] font-medium text-brand-muted">Key phrases (optional)</p>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  <input
                    value={customPhrase1}
                    onChange={(e) => setCustomPhrase1(e.target.value)}
                    placeholder="Phrase 1"
                    className="rounded-lg border border-brand-border bg-brand-panel px-2 py-1.5 text-xs text-brand-text"
                  />
                  <input
                    value={customPhrase2}
                    onChange={(e) => setCustomPhrase2(e.target.value)}
                    placeholder="Phrase 2"
                    className="rounded-lg border border-brand-border bg-brand-panel px-2 py-1.5 text-xs text-brand-text"
                  />
                  <input
                    value={customPhrase3}
                    onChange={(e) => setCustomPhrase3(e.target.value)}
                    placeholder="Phrase 3"
                    className="rounded-lg border border-brand-border bg-brand-panel px-2 py-1.5 text-xs text-brand-text"
                  />
                </div>
                <p className="text-[11px] font-medium text-brand-muted">
                  Scene examples (2–3 recommended)
                </p>
                {(
                  [
                    [customScene1Title, setCustomScene1Title, customScene1Body, setCustomScene1Body, "Scene 1"],
                    [customScene2Title, setCustomScene2Title, customScene2Body, setCustomScene2Body, "Scene 2"],
                    [customScene3Title, setCustomScene3Title, customScene3Body, setCustomScene3Body, "Scene 3"],
                  ] as const
                ).map(([title, setTitle, body, setBody, label], idx) => (
                  <div key={label} className="grid gap-1 rounded-lg border border-brand-border/50 p-2">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`${label} title (e.g. Mirror tease)`}
                      className="rounded-lg border border-brand-border bg-brand-panel px-2 py-1.5 text-xs text-brand-text"
                    />
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={`${label} body — what happens + a line of dialogue`}
                      rows={2}
                      className="rounded-lg border border-brand-border bg-brand-panel px-2 py-1.5 text-xs text-brand-text"
                    />
                    {idx === 0 ? null : null}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMediaAdvanced((v) => !v)}
                    className="rounded-lg border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-accent"
                  >
                    {showMediaAdvanced ? "Hide custom clips" : "Custom clips…"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCustom}
                    disabled={
                      creating || customName.trim().length < 2 || customAppearance.trim().length < 12
                    }
                    className="ml-auto rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim disabled:opacity-50"
                  >
                    {creating ? "Saving…" : account ? "Save My Character" : "Sign in to save"}
                  </button>
                </div>

                {showMediaAdvanced && (
                  <div className="grid gap-2 rounded-lg border border-dashed border-brand-border/80 p-2">
                    <p className="text-[11px] leading-relaxed text-brand-muted">
                      Point at a folder of loops under the web app (e.g.{" "}
                      <code className="text-brand-text">/avatar/packs/diego</code> with{" "}
                      idle/teasing/playful/aroused.mp4) or paste full https URLs per emotion.
                    </p>
                    <input
                      value={mediaBase}
                      onChange={(e) => setMediaBase(e.target.value)}
                      placeholder="Media base folder — /avatar/packs/your-name"
                      className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["idle", clipIdle, setClipIdle],
                          ["teasing", clipTeasing, setClipTeasing],
                          ["playful", clipPlayful, setClipPlayful],
                          ["aroused", clipAroused, setClipAroused],
                        ] as const
                      ).map(([emotion, value, setValue]) => (
                        <div key={emotion} className="space-y-1">
                          <ClipPreview
                            src={
                              value ||
                              (mediaBase
                                ? `${mediaBase.replace(/\/$/, "")}/${emotion}.mp4`
                                : `/avatar/${customBase}/${emotion}.mp4`)
                            }
                            label={emotion}
                          />
                          <input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={`${emotion} clip URL (optional)`}
                            className="w-full rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!sessionActive &&
              characters.some((c) => c.id === character && c.kind === "custom") && (
                <div className="rounded-lg border border-brand-border/70 bg-brand-bg p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-brand-muted">
                      Edit clips for{" "}
                      <span className="text-brand-text">
                        {characters.find((c) => c.id === character)?.displayName}
                      </span>
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-brand-muted">
                        <input
                          type="checkbox"
                          checked={
                            characters.find((c) => c.id === character)?.featured === true
                          }
                          disabled={creating}
                          onChange={(e) => {
                            const selected = characters.find((c) => c.id === character);
                            if (!selected || selected.kind !== "custom") return;
                            void (async () => {
                              setCreating(true);
                              try {
                                const updated = await updateCustomCharacter(selected.id, {
                                  featured: e.target.checked,
                                });
                                setCharacters((prev) =>
                                  prev.map((c) =>
                                    c.id === selected.id
                                      ? { ...c, featured: updated.featured === true }
                                      : c,
                                  ),
                                );
                                flashCopy(
                                  e.target.checked
                                    ? "Pinned to Featured row"
                                    : "Removed from Featured",
                                );
                              } catch (err) {
                                setError(
                                  err instanceof Error ? err.message : "Could not update featured",
                                );
                              } finally {
                                setCreating(false);
                              }
                            })();
                          }}
                        />
                        Featured
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowMediaAdvanced((v) => !v)}
                        className="text-xs text-brand-accent hover:underline"
                      >
                        {showMediaAdvanced ? "Hide" : "Edit media"}
                      </button>
                    </div>
                  </div>
                  {showMediaAdvanced && (
                    <div className="grid gap-2">
                      <input
                        value={mediaBase}
                        onChange={(e) => setMediaBase(e.target.value)}
                        placeholder="Media base — /avatar/packs/name or leave blank for fallback pack"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                      />
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand-accent/40 bg-brand-accent/5 px-3 py-3 text-center text-xs text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
                        <span className="font-medium text-brand-text">
                          {creating ? "Uploading…" : "Batch upload clips"}
                        </span>
                        <span>
                          Select multiple files named idle / teasing / playful / aroused
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/x-m4v,.mp4,.webm"
                          multiple
                          className="hidden"
                          disabled={creating}
                          onChange={(e) => {
                            const list = e.target.files;
                            e.target.value = "";
                            void handleBatchUpload(list);
                          }}
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            ["idle", clipIdle, setClipIdle],
                            ["teasing", clipTeasing, setClipTeasing],
                            ["playful", clipPlayful, setClipPlayful],
                            ["aroused", clipAroused, setClipAroused],
                          ] as const
                        ).map(([emotion, value, setValue]) => {
                          const selected = characters.find((c) => c.id === character);
                          const previewSrc =
                            value ||
                            selected?.clips?.[emotion] ||
                            (mediaBase
                              ? `${mediaBase.replace(/\/$/, "")}/${emotion}.mp4`
                              : selected?.avatarBase
                                ? `/avatar/${selected.avatarBase}/${emotion}.mp4`
                                : null);
                          return (
                            <div key={emotion} className="space-y-1">
                              <ClipPreview src={previewSrc} label={emotion} />
                              <input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={`${emotion} URL (optional)`}
                                className="w-full rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                              />
                              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-brand-border/80 bg-brand-panel/50 px-2 py-1.5 text-[11px] text-brand-muted hover:border-brand-accent">
                                <span>Upload {emotion}.mp4/.webm</span>
                                <input
                                  type="file"
                                  accept="video/mp4,video/webm,video/x-m4v,.mp4,.webm"
                                  className="hidden"
                                  disabled={creating}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    e.target.value = "";
                                    void handleUploadClip(emotion, file);
                                  }}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-brand-muted">
                        Uploads store on the API volume and update this character&apos;s clip map
                        (max ~40MB each). Only real MP4/WebM — type + file header checked.
                      </p>
                      <button
                        type="button"
                        onClick={handleSaveMediaForSelected}
                        disabled={creating}
                        className="justify-self-end rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {creating ? "Saving…" : "Save clip pack"}
                      </button>
                    </div>
                  )}
                </div>
              )}
          </section>

          <section
            className={`relative flex flex-1 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-panel/95 shadow-card backdrop-blur-sm ${
              avatarCollapsed
                ? "min-h-[min(70dvh,560px)] sm:min-h-[480px]"
                : "min-h-[min(52dvh,420px)] sm:min-h-[380px]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-brand-border/60 px-3 py-1.5 sm:px-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[11px] text-brand-muted">
                  {messages.length > 0
                    ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                    : "Transcript"}
                  {avatarCollapsed ? " · avatar hidden" : ""}
                  {headerMind ? ` · ${headerMind.tag}` : ""}
                </p>
                {status === "ready" && (
                  <SessionDepthMeter
                    messageCount={messages.length}
                    liveSeconds={liveSeconds}
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                {bandFlash && (
                  <span
                    className={`animate-fade-in rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${energyBandBadgeClass(bandFlash)}`}
                  >
                    {energyBandLabel(bandFlash)} heat
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setAvatarCollapsedPersist(!avatarCollapsed)}
                  className="text-[11px] text-brand-accent hover:underline"
                  title={
                    avatarCollapsed
                      ? "Show avatar video and status"
                      : "Hide avatar for more chat space"
                  }
                >
                  {avatarCollapsed ? "Show avatar" : "Hide avatar"}
                </button>
              </div>
            </div>
            <div
              ref={messagesScrollRef}
              onScroll={onMessagesScroll}
              className={`relative flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4 ${transcriptAmbient}`}
            >
              {(() => {
                const mind = mindFingerprint(activeCharacterId ?? character);
                if (!mind) return null;
                return (
                  <div
                    className="rounded-xl border border-brand-accent/25 bg-brand-accent/5 px-3 py-2 text-[11px] leading-relaxed"
                    role="status"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                        Mind · {mind.tag}
                      </p>
                      {mind.bilingual && (
                        <span className="rounded-full border border-brand-border/80 px-2 py-0.5 text-[9px] text-brand-muted">
                          Soft ES spice
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-brand-muted">{mind.blurb}</p>
                  </div>
                );
              })()}
              {modeState && modeState.mode === "edge_pace" && status === "ready" && (
                <EdgePaceStrip modeState={modeState} tickOffset={modeTick} />
              )}
              <RejoinRecapToast
                show={rejoinRecap.show && status === "ready"}
                characterId={activeCharacterId ?? character}
                characterName={characterName ?? headerCharacterName}
                recapLine={rejoinRecap.line}
                priorNotes={priorNotes}
                onDismiss={() => setRejoinRecap((r) => ({ ...r, show: false }))}
              />
              <SessionWinToast
                show={status === "ready"}
                characterId={activeCharacterId ?? character}
                characterName={characterName ?? headerCharacterName}
                resumeCode={resumeCode}
                messageCount={messages.length}
              />
              {(status === "ready" ||
                messages.length > 0 ||
                (!!priorNotes && status !== "connecting")) && (
                <SessionMemoryStrip priorNotes={priorNotes} sessionNotes={sessionNotes} />
              )}
              {/* Opening continuity before first message lands */}
              {messages.length === 0 &&
                !isTyping &&
                selectedOpening &&
                status !== "connecting" &&
                !restarting && (
                  <OpeningLinePreview
                    characterId={activeCharacterId ?? character}
                    characterName={headerCharacterName}
                    openingMessage={selectedOpening}
                    variant={status === "ready" ? "live" : "idle"}
                    onSeedReply={(text) => {
                      setInput(text);
                      window.setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  />
                )}
              {messages.length === 0 && !isTyping && (
                <div className="px-2 py-10 text-center sm:py-14">
                  {(status === "connecting" || restarting) && (
                    <div className="mx-auto mb-5 max-w-sm animate-fade-in">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-accentDim to-brand-accent text-xl font-semibold text-white shadow-glow-sm">
                        {(headerCharacterName ?? "?").charAt(0)}
                      </div>
                      <p className="mt-3 text-base font-semibold text-brand-text">
                        {headerCharacterName
                          ? `Opening ${headerCharacterName}…`
                          : "Opening live session…"}
                      </p>
                      {headerMind && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">
                          <span className="font-semibold text-brand-accent">{headerMind.tag}</span>
                          {" · "}
                          {headerMind.blurb}
                        </p>
                      )}
                      {selectedOpening && (
                        <p className="mt-2 line-clamp-3 text-[11px] italic leading-relaxed text-brand-muted/90">
                          “{selectedOpening}”
                        </p>
                      )}
                      <p className="mt-3 text-xs text-brand-muted animate-pulse">
                        Wiring avatar + mind…
                      </p>
                    </div>
                  )}
                  {status !== "connecting" && !restarting && (
                  <p className="text-sm text-brand-muted">
                    {status === "ready"
                      ? priorNotes
                        ? "Session live — they still remember you. Heat continues from the strip above."
                        : headerCharacterName
                          ? `${headerCharacterName} is live — they should greet you first.`
                          : "Session live — they should greet you first. Memory saves as you go."
                      : savedSession
                          ? `Welcome back — resume “${savedSession.characterName ?? savedSession.characterId}” or start a new session.`
                          : priorNotes
                            ? "They kept a little of you — Start to pick up the heat."
                            : headerCharacterName
                              ? `Ready for ${headerCharacterName}. Choose Normal or Edge Pace, then Start.`
                              : "Pick a character, choose Normal or Edge Pace, then Start."}
                  </p>
                  )}
                  {status !== "ready" && status !== "connecting" && !restarting && !selectedOpening && (
                    <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-brand-soft">
                      {headerMind
                        ? `${headerMind.tag} · ${headerMind.blurb}`
                        : "Signature models open with a brand line. Edge Pace adds soft build → hold → almost → breathe cycles. Free path always works."}
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1;
                const prev = i > 0 ? messages[i - 1] : null;
                const showMindTag =
                  msg.role === "assistant" &&
                  !!headerMind &&
                  (!prev || prev.role === "user" || !!msg.streaming);
                const showAfterglow =
                  isLast &&
                  msg.role === "assistant" &&
                  !msg.streaming &&
                  status === "ready" &&
                  !sending &&
                  !isTyping;
                return (
                <div
                  key={msg.id}
                  className={`flex flex-col animate-rise-in ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition-[box-shadow,ring] duration-500 sm:max-w-[80%] sm:px-4 ${
                      msg.role === "user"
                        ? `bg-brand-accent text-white shadow-glow-sm ${sendPulse && isLast ? "ring-2 ring-white/30" : ""}`
                        : `border text-brand-text ${assistantBubbleClass} ${
                            msg.streaming
                              ? "ring-1 ring-brand-accent/30"
                              : arrivalId === msg.id
                                ? "ring-2 ring-brand-accent/50 shadow-glow-sm"
                                : ""
                          }`
                    }`}
                  >
                    {showMindTag && (
                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-accent/80">
                        {headerCharacterName?.split(/\s+/)[0] || "Them"}
                        {" · "}
                        {headerMind!.tag}
                      </p>
                    )}
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    {msg.streaming && (
                      <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-brand-accent align-middle" />
                    )}
                  </div>
                  {showAfterglow && (
                    <div className="max-w-[90%] sm:max-w-[80%]">
                      <AfterglowChips
                        characterId={activeCharacterId ?? character}
                        disabled={sending}
                        intense={
                          modeState?.mode === "edge_pace" &&
                          modeState.phase === "almost"
                        }
                        onFire={(text) => sendMessage(text)}
                        onPick={(text) => {
                          setInput((prev) => {
                            const p = prev.trim();
                            if (!p) return text;
                            return `${p} ${text}`;
                          });
                          window.setTimeout(() => inputRef.current?.focus(), 40);
                        }}
                      />
                    </div>
                  )}
                </div>
                );
              })}

              {isTyping && (
                <TypingIndicator
                  name={characterName ?? headerCharacterName}
                  characterId={activeCharacterId ?? character}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {showJumpLatest && messages.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[5.5rem] z-10 flex justify-center sm:bottom-[6.25rem]">
                <button
                  type="button"
                  onClick={jumpToLatest}
                  className="pointer-events-auto btn-primary min-h-0 animate-rise-in rounded-full px-4 py-1.5 text-xs shadow-glow"
                >
                  Jump to latest
                  {isTyping ? " · typing" : ""}
                </button>
              </div>
            )}

            {/* Composer — sticky + safe-area so home indicator / keyboard stay clear */}
            <div
              className={`sticky bottom-0 z-20 border-t border-brand-border/80 bg-brand-panel/95 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[box-shadow,border-color] duration-500 sm:p-4 sm:pb-4 ${edgePaceComposerClass(modeState, status)} ${
                sendPulse ? "ring-1 ring-inset ring-brand-accent/40" : ""
              } ${arrivalId ? "ring-1 ring-inset ring-brand-accent/25" : ""}`}
            >
              <ComposerVibeChip
                characterId={activeCharacterId ?? character}
                characterName={headerCharacterName}
                sessionMode={sessionMode}
                modeState={modeState}
                tickOffset={modeTick}
                status={status}
                arousalPct={
                  avatarState
                    ? Math.round((avatarState.arousalLevel ?? 0) * 100)
                    : null
                }
              />
              {status === "ready" && (
                <HeatWhisperStrip
                  characterId={activeCharacterId ?? character}
                  modeState={modeState}
                  tickOffset={modeTick}
                />
              )}
              {status === "ready" && messages.length <= 4 && !sending && !isTyping && (
                <QuickReplyChips
                  characterId={activeCharacterId ?? character}
                  characterName={characterName ?? headerCharacterName}
                  disabled={status !== "ready"}
                  onFire={(text) => sendMessage(text)}
                  onPick={(text) => {
                    setInput((prev) => {
                      const p = prev.trim();
                      if (!p) return text;
                      if (p.endsWith(text)) return prev;
                      return `${p} ${text}`;
                    });
                    window.setTimeout(() => inputRef.current?.focus(), 40);
                  }}
                />
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    // Phone: auto-collapse avatar on focus so keyboard + chat fit
                    if (
                      typeof window !== "undefined" &&
                      window.matchMedia("(max-width: 639px)").matches &&
                      !avatarCollapsed
                    ) {
                      setAvatarCollapsedPersist(true);
                    }
                    // Keep focused input above soft keyboard
                    window.setTimeout(() => {
                      inputRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }, 120);
                  }}
                  placeholder={
                    status === "ready"
                      ? modeState?.mode === "edge_pace" && modeState.phase
                        ? `Reply in ${modeState.phase}… (Enter to send)`
                        : headerCharacterName
                          ? `Message ${headerCharacterName.split(/\s+/)[0]}… (draft saves)`
                          : "Message… (draft saves)"
                      : connectionDropped
                        ? "Rejoin to keep chatting"
                        : input.trim()
                          ? "Draft saved — Start to send"
                          : "Start a session first"
                  }
                  disabled={status !== "ready" || sending}
                  rows={avatarCollapsed ? 3 : 2}
                  enterKeyHint="send"
                  autoComplete="off"
                  className={`field min-h-touch flex-1 resize-none py-2.5 text-base disabled:opacity-50 sm:min-h-[2.75rem] sm:text-sm ${
                    input.trim() && status !== "ready" ? "field-has-draft" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  className={`btn-primary min-h-touch shrink-0 px-4 disabled:opacity-50 sm:min-h-[2.75rem] sm:px-5 ${
                    sendPulse ? "scale-95 ring-2 ring-white/40 shadow-glow" : ""
                  } ${sending ? "opacity-80" : ""}`}
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </div>
          </section>
          </div>
        </div>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-brand-border/40 py-3 text-[11px] text-brand-muted sm:text-xs">
          <span className="inline-flex items-center gap-1.5 sm:hidden">
            <StatusDot status={status} />
            {statusLabel}
          </span>
          <span className="hidden sm:inline">Uncensored 18+ · Procharacters.cloud</span>
          {sessionId && <span className="font-mono">#{sessionId.slice(0, 8)}</span>}
          <span className="sm:hidden">18+ · KGC</span>
        </footer>
      </div>

      {/* Picture-in-picture mini avatar — draggable when rail is collapsed */}
      {avatarCollapsed && avatarPip && (
        <AvatarPip
          avatar={avatarState}
          characterName={characterName}
          characterId={activeCharacterId ?? character}
          onExpand={() => setAvatarCollapsedPersist(false)}
          onHide={() => setAvatarPipPersist(false)}
        />
      )}
    </main>
  );
}