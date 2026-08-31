"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarVideo } from "@/components/AvatarVideo";
import { ImportPreviewPanel } from "@/components/ImportPreviewPanel";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
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
  fetchAccountMe,
  fetchBillingStatus,
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
import { RejoinRecapToast } from "@/components/RejoinRecapToast";
import { DraftRecoveryHint } from "@/components/DraftRecoveryHint";
import { AfterglowChips } from "@/components/AfterglowChips";
import { NetworkOfflineBanner } from "@/components/NetworkOfflineBanner";
import { heatDepthFromMessages } from "@/components/SessionDepthMeter";
import { SessionPausedBanner } from "@/components/SessionPausedBanner";
import { MyCharacterWinToast } from "@/components/MyCharacterWinToast";
import { SessionWinToast } from "@/components/SessionWinToast";
import { SoftSupportHint } from "@/components/SoftSupportHint";
import { PushEnableHint } from "@/components/PushEnableHint";
import { HintRail } from "@/components/HintRail";
import { OverflowMenu } from "@/components/OverflowMenu";
import { SiteChrome } from "@/components/SiteChrome";
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
  replaceCharacterInUrl,
  shareOrCopyText,
  shareOrCopyUrl,
  shareResultLabel,
  shareUrlResultLabel,
} from "@/lib/share-links";
import {
  hasPendingShareDeepLink,
  initialPickerCharacterId,
  resolveCharacterDeepLink,
  resolveChatBootIdentity,
  snapshotShareQuery,
} from "@/lib/chat-deeplink";
import { mindFingerprint } from "@/lib/mind-fingerprint";
import {
  energyBandBadgeClass,
  energyBandFromAvatar,
  energyBandLabel,
  dnaAssistantBubbleClass,
  dnaChromeClass,
  dnaComposerClass,
  dnaTreeHeatLevel,
  dnaUserBubbleClass,
  liveRoomWashClass,
  type EnergyBand,
} from "@/lib/energy";
import {
  presenceAmbientClass,
  presenceBubbleClass,
  resolvePresenceSkin,
} from "@/lib/presence";
import {
  getResumeForCharacter,
  heatTrailFromSession,
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
  const [catalogReady, setCatalogReady] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [character, setCharacter] = useState<CharacterId>(() =>
    initialPickerCharacterId(),
  );
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
  /** When set, create form is edit mode for this custom id. */
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Soft cap for My Characters (free 10 / premium higher). */
  const [customsLimit, setCustomsLimit] = useState(10);
  const [activePremium, setActivePremium] = useState(false);
  /** Post-create celebration — Start heat / Edge / My models. */
  const [justCreated, setJustCreated] = useState<{
    id: string;
    name: string;
  } | null>(null);
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
  /** Session notes from the API — used silently for rejoin recap, not shown as chrome. */
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
  /** Snapshot after End — morph goodbye into return (+ heat trail). */
  const [pauseSnapshot, setPauseSnapshot] = useState<{
    characterId: string;
    characterName: string | null;
    resumeCode: string | null;
    messageCount: number;
    heatDepth?: import("@/lib/resume-cache").HeatTrailDepth | null;
    heatChips?: string[] | null;
    recapLine?: string | null;
    dnaTreeLabel?: string | null;
    dnaTreeNodeId?: string | null;
  } | null>(null);
  /** Live session stopwatch (seconds) while status === ready. */
  const [liveSeconds, setLiveSeconds] = useState(0);
  const liveStartedAtRef = useRef<number | null>(null);
  /** Opt-in long-term dossier (across sessions). */
  const [priorNotes, setPriorNotes] = useState<string | null>(null);
  const [messageWindow] = useState<20 | 30 | 50 | 80>(50);
  const [crossSessionOptIn, setCrossSessionOptIn] = useState(true);
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

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingHistoryRef = useRef<ChatMessage[] | null>(null);
  const deepLinkHandledRef = useRef(false);
  /** First client search string — idle URL sync must not clobber this. */
  const incomingQueryRef = useRef<ReturnType<typeof snapshotShareQuery> | null>(null);
  if (typeof window !== "undefined" && incomingQueryRef.current === null) {
    incomingQueryRef.current = snapshotShareQuery();
  }
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

  const stampHeatTrail = useCallback(
    (characterId: string, notes?: string | null, count?: number) => {
      if (!characterId) return;
      void import("@/lib/resume-cache").then(
        ({ heatTrailFromSession, rememberHeatTrail }) => {
          const mind = mindFingerprint(characterId);
          const trail = heatTrailFromSession({
            sessionNotes: notes ?? sessionNotes,
            messageCount: count ?? messages.length,
            mindTag: mind?.tag,
            dnaTreeNodeId: modeState?.dnaTreeNodeId,
            dnaTreeLabel: modeState?.dnaTreeLabel,
          });
          rememberHeatTrail(characterId, trail);
        },
      );
    },
    [messages.length, sessionNotes, modeState?.dnaTreeNodeId, modeState?.dnaTreeLabel],
  );

  const rememberSession = useCallback(
    (info: {
      sessionId: string;
      wsToken: string;
      characterId: string;
      characterName?: string | null;
      resumeCode?: string | null;
      resumeExpiresAt?: string | null;
      sessionNotes?: string | null;
      messageCount?: number;
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
        void import("@/lib/resume-cache").then(
          ({ rememberLocalResume, heatTrailFromSession }) => {
            const mind = mindFingerprint(info.characterId);
            const trail = heatTrailFromSession({
              sessionNotes: info.sessionNotes ?? sessionNotes,
              messageCount: info.messageCount ?? messages.length,
              mindTag: mind?.tag,
              dnaTreeNodeId: modeState?.dnaTreeNodeId,
              dnaTreeLabel: modeState?.dnaTreeLabel,
            });
            rememberLocalResume({
              characterId: info.characterId,
              characterName: info.characterName,
              sessionId: info.sessionId,
              resumeCode: info.resumeCode!,
              resumeExpiresAt: info.resumeExpiresAt,
              recapLine: trail.recapLine,
              heatDepth: trail.heatDepth,
              heatChips: trail.heatChips,
              messageCount: trail.messageCount,
              mindTag: trail.mindTag,
              dnaTreeNodeId: trail.dnaTreeNodeId,
              dnaTreeLabel: trail.dnaTreeLabel,
            });
          },
        );
      }
    },
    [messages.length, sessionNotes, modeState?.dnaTreeNodeId, modeState?.dnaTreeLabel],
  );

  const endSession = useCallback(() => {
    // End on server but keep local resume credentials (memory is persisted server-side).
    intentionalCloseRef.current = true;
    setConnectionDropped(false);
    const cid = activeCharacterId ?? character;
    const mind = mindFingerprint(cid);
    const trail = heatTrailFromSession({
      sessionNotes,
      messageCount: messages.length,
      mindTag: mind?.tag,
      dnaTreeNodeId: modeState?.dnaTreeNodeId,
      dnaTreeLabel: modeState?.dnaTreeLabel,
    });
    setPauseSnapshot({
      characterId: cid,
      characterName,
      resumeCode: resumeCode ?? savedSession?.resumeCode ?? null,
      messageCount: messages.length,
      heatDepth: trail.heatDepth,
      heatChips: trail.heatChips,
      recapLine: trail.recapLine,
      dnaTreeLabel: trail.dnaTreeLabel ?? modeState?.dnaTreeLabel,
      dnaTreeNodeId: trail.dnaTreeNodeId ?? modeState?.dnaTreeNodeId,
    });
    closeSocket(true);
    if (sessionId && wsToken && cid) {
      rememberSession({
        sessionId,
        wsToken,
        characterId: cid,
        characterName,
        resumeCode,
        sessionNotes,
        messageCount: messages.length,
      });
      stampHeatTrail(cid, sessionNotes, messages.length);
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
    modeState?.dnaTreeLabel,
    modeState?.dnaTreeNodeId,
    rememberSession,
    resumeCode,
    savedSession?.resumeCode,
    sessionId,
    sessionNotes,
    stampHeatTrail,
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

  // First assistant line landed — soft celebration (once per session open)
  const firstOpenFlashedRef = useRef(false);
  useEffect(() => {
    if (status !== "ready") {
      firstOpenFlashedRef.current = false;
      return;
    }
    if (firstOpenFlashedRef.current) return;
    const firstAssistant = messages.find(
      (m) => m.role === "assistant" && !m.streaming && m.content?.trim(),
    );
    if (!firstAssistant) return;
    firstOpenFlashedRef.current = true;
    const nick =
      characterName?.split(/\s+/)[0] ||
      characters.find((c) => c.id === (activeCharacterId ?? character))
        ?.displayName?.split(/\s+/)[0] ||
      "They";
    setCopyNotice(`${nick} is live · heat on`);
    window.setTimeout(() => setCopyNotice(null), 2200);
  }, [status, messages, characterName, characters, activeCharacterId, character]);

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
    setCatalogReady(false);
    listLiveCharacters(account?.token)
      .then((list) => {
        if (cancelled || list.length === 0) return;
        // Mine first → signatures → other customs (picker + default select)
        const ordered = [...list].sort((a, b) => {
          const am = a.mine ? 0 : a.kind === "default" ? 1 : 2;
          const bm = b.mine ? 0 : b.kind === "default" ? 1 : 2;
          if (am !== bm) return am - bm;
          return a.displayName.localeCompare(b.displayName);
        });
        setCharacters(ordered);
        const query = incomingQueryRef.current ?? snapshotShareQuery();
        setCharacter((current) => {
          if (query.characterId && ordered.some((c) => c.id === query.characterId)) {
            return query.characterId!;
          }
          return ordered.some((c) => c.id === current) ? current : ordered[0]!.id;
        });
      })
      .catch(() => {
        /* keep fallback list */
      })
      .finally(() => {
        if (!cancelled) setCatalogReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [account?.token]);

  useEffect(() => {
    setSavedSession(loadStoredSession());
    const storedAccount = loadStoredAccount();
    setAccount(storedAccount);
    setAccountReady(true);
    if (storedAccount) {
      void refreshAccountSessions(storedAccount.token);
    }
  }, [refreshAccountSessions]);

  // Prefill identity/vibe/clothing from selected base model (Phase 5) — create only
  useEffect(() => {
    if (!showCreate || editingCustomId) return;
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
  }, [customBaseModel, showCreate, editingCustomId]);

  // Prefill clip editors when a custom character is selected (not while form is open)
  useEffect(() => {
    if (showCreate) return;
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") return;
    setMediaBase(selected.mediaBase ?? "");
    setClipIdle(selected.mediaOverrides?.idle ?? "");
    setClipTeasing(selected.mediaOverrides?.teasing ?? "");
    setClipPlayful(selected.mediaOverrides?.playful ?? "");
    setClipAroused(selected.mediaOverrides?.aroused ?? "");
  }, [character, characters, showCreate]);

  // Keep address bar shareable without private tokens after boot.
  // Must not run before the incoming ?character=&autostart= / resume query is
  // consumed — replaceCharacterInUrl strips those flags and would leave the
  // picker on the default twink-default id.
  useEffect(() => {
    if (status === "idle" || status === "ended" || status === "error") {
      if (
        !deepLinkHandledRef.current &&
        hasPendingShareDeepLink(incomingQueryRef.current)
      ) {
        return;
      }
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
            // Sexy first open: Studio DNA starter → composer seed (fresh sessions only)
            try {
              const histLen = history?.length ?? 0;
              const rawStarter = sessionStorage.getItem("pc_studio_starter");
              if (rawStarter && histLen <= 2) {
                const parsed = JSON.parse(rawStarter) as {
                  characterId?: string;
                  starter?: string;
                  at?: number;
                };
                const fresh =
                  !parsed.at || Date.now() - Number(parsed.at) < 30 * 60_000;
                if (
                  fresh &&
                  parsed.characterId === session.characterId &&
                  parsed.starter?.trim()
                ) {
                  const seed = parsed.starter.trim().slice(0, 400);
                  setInput((prev) => (prev.trim() ? prev : seed));
                  const edge =
                    data.sessionMode === "edge_pace" ||
                    (typeof data.modeState === "object" &&
                      data.modeState &&
                      (data.modeState as { mode?: string }).mode === "edge_pace");
                  setCopyNotice(
                    edge
                      ? "DNA starter ready · Fire ↵ to climb Edge"
                      : "DNA starter ready · Fire ↵ to open heat",
                  );
                  window.setTimeout(() => setCopyNotice(null), 2800);
                  sessionStorage.removeItem("pc_studio_starter");
                }
              } else if (rawStarter) {
                // Stale / resume — drop so it doesn't poison later
                sessionStorage.removeItem("pc_studio_starter");
              }
            } catch {
              /* ignore starter seed */
            }
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
            const nextMode =
              data.modeState && typeof data.modeState === "object"
                ? (data.modeState as SessionModeUiState)
                : null;
            if (notes?.trim()) {
              const trimmed = notes.trim();
              setSessionNotes(trimmed);
              const mind = mindFingerprint(session.characterId);
              const turns =
                Number(trimmed.match(/~(\d+)\s*turn/i)?.[1]) || 0;
              const trail = heatTrailFromSession({
                sessionNotes: trimmed,
                messageCount: turns > 0 ? turns * 2 : undefined,
                mindTag: mind?.tag,
                dnaTreeNodeId: nextMode?.dnaTreeNodeId,
                dnaTreeLabel: nextMode?.dnaTreeLabel,
              });
              rememberResumeRecap(
                session.characterId,
                trail.recapLine ?? recapFromSessionNotes(trimmed),
                trail,
              );
            }
            if (typeof data.priorNotes === "string" && data.priorNotes.trim()) {
              setPriorNotes(data.priorNotes.trim());
            }
            if (nextMode) {
              setModeState(nextMode);
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

      if (account?.token) {
        try {
          await setCrossSessionMemoryOptIn(account.token, characterId, true);
        } catch {
          /* still try create with flag */
        }
      }

      const mode = options?.sessionMode ?? sessionMode;
      const session = await createSession(characterId, account?.token, {
        messageWindow,
        useCrossSessionMemory: !!account?.token,
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

  // Soft cap for create form (premium payoff after Day Pass)
  useEffect(() => {
    if (!account?.token) {
      setCustomsLimit(10);
      setActivePremium(false);
      return;
    }
    let cancelled = false;
    void fetchBillingStatus(account.token)
      .then((b) => {
        if (cancelled) return;
        setCustomsLimit(b.customsLimit ?? 10);
        setActivePremium(!!b.activePremium);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [account?.token]);

  // Deep-link: ?create=1 → Studio; ?edit=1&character= → /models/studio/edit/:id
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = incomingQueryRef.current ?? snapshotShareQuery();
    if (query.edit && query.characterId) {
      window.location.replace(
        `/models/studio/edit/${encodeURIComponent(query.characterId)}`,
      );
      return;
    }
    if (!query.create) return;
    window.location.replace("/models/studio");
  }, []);

  // Deep-links: ?magic=  ?character=  ?resume=  or legacy ?session=&token=
  // Read the snapshotted query — idle URL sync used to rewrite the bar to
  // twink-default and strip autostart before this effect ran.
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;

    const query = incomingQueryRef.current ?? snapshotShareQuery();

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

    if (query.resumeCode) {
      deepLinkHandledRef.current = true;
      void (async () => {
        try {
          setStatus("connecting");
          // DNA power reclaim: ?mode=edge_pace on Continue deep-links
          if (query.sessionMode) {
            setSessionMode(query.sessionMode);
          }
          const session = await resumeByCode(query.resumeCode!, {
            sessionMode: query.sessionMode,
          });
          if (session.sessionMode === "edge_pace" || session.sessionMode === "normal") {
            setSessionMode(session.sessionMode);
          }
          await openLiveSession(session, {
            forceRehydrate: query.rehydrate !== false,
          });
          if (query.sessionMode === "edge_pace" || session.sessionMode === "edge_pace") {
            setCopyNotice("DNA power reclaim · Edge Pace + heat restored");
            window.setTimeout(() => setCopyNotice(null), 3200);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Invalid resume code");
          setStatus("error");
        }
      })();
      return;
    }

    if (query.sessionId && query.token) {
      deepLinkHandledRef.current = true;
      const stored: StoredSession = {
        sessionId: query.sessionId,
        wsToken: query.token,
        characterId: query.characterId ?? "twink-default",
        savedAt: new Date().toISOString(),
      };
      void resumeLastSession(stored);
      return;
    }

    if (!query.characterId) return;

    const decision = resolveCharacterDeepLink({
      query,
      catalogIds: characters.map((c) => c.id),
      catalogReady: catalogReady && accountReady,
    });
    if (decision.action === "wait" || decision.action === "none") return;

    deepLinkHandledRef.current = true;

    if (decision.action === "unknown") {
      setError(
        `Unknown character “${decision.characterId}” — it may be a custom model not on this server.`,
      );
      return;
    }

    setCharacter(decision.characterId);
    // Deep-link mode=edge_pace must apply before createSession (state alone is too late).
    if (decision.sessionMode) {
      setSessionMode(decision.sessionMode);
    }
    if (decision.autostart) {
      void startSession(
        decision.characterId,
        decision.sessionMode ? { sessionMode: decision.sessionMode } : undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once when catalog ready
  }, [characters, catalogReady, accountReady]);

  const flashCopy = (label: string) => {
    setCopyNotice(label);
    window.setTimeout(() => setCopyNotice(null), 2200);
  };

  const shareCharacterLink = async (autostart = false) => {
    const live = characters.find((c) => c.id === character);
    // Private My Characters aren't on the public gallery — prefer resume share.
    if (live?.mine === true || (live?.kind === "custom" && live.visibility === "private")) {
      if (resumeCode) {
        const url = buildResumeCodeShareUrl(resumeCode, {
          characterId: activeCharacterId ?? character,
        });
        const result = await shareOrCopyUrl({
          url,
          title: "Resume Procharacters chat",
          text: `Continue your private chat (code ${resumeCode})`,
        });
        const label = shareUrlResultLabel(result, `Resume ${resumeCode}`);
        flashCopy(
          label
            ? `${label} · private mind (code only)`
            : "Private model — resume code shared",
        );
        return;
      }
      flashCopy(
        "Private My Character — only you can open it. Start chat to share a resume code.",
      );
      return;
    }
    const url = buildCharacterShareUrl(character, { autostart, card: !autostart });
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
      const dnaPower =
        !!modeState?.dnaTreeNodeId ||
        !!modeState?.dnaTreeLabel ||
        sessionMode === "edge_pace";
      if (code) {
        setStatus("connecting");
        if (dnaPower) setSessionMode("edge_pace");
        const session = await resumeByCode(code, {
          sessionMode: dnaPower ? "edge_pace" : undefined,
        });
        if (session.sessionMode === "edge_pace" || session.sessionMode === "normal") {
          setSessionMode(session.sessionMode);
        }
        await openLiveSession(session, { forceRehydrate: true });
        if (dnaPower) {
          setCopyNotice("DNA power reclaim · line restored");
          window.setTimeout(() => setCopyNotice(null), 2800);
        }
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
    modeState?.dnaTreeLabel,
    modeState?.dnaTreeNodeId,
    openLiveSession,
    resumeCode,
    savedSession,
    sessionId,
    sessionMode,
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

  const resetCustomForm = () => {
    setEditingCustomId(null);
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
  };

  const openCreateForm = () => {
    resetCustomForm();
    setShowCreate(true);
  };

  const openEditCustom = (id?: string) => {
    const selected = characters.find((c) => c.id === (id ?? character));
    if (!selected || selected.kind !== "custom") {
      setError("Select a custom My Character to edit");
      return;
    }
    if (!account?.token) {
      setError("Sign in to edit a My Character");
      setShowAccount(true);
      return;
    }
    setEditingCustomId(selected.id);
    setCustomName(selected.displayName);
    setCustomAppearance(selected.appearance ?? "");
    setCustomEnergy(selected.energy ?? selected.energyLabel ?? "");
    setCustomClothing(selected.clothing ?? "");
    setCustomBaseModel(selected.baseModelId ?? selected.avatarBase ?? "twink-default");
    const base = selected.avatarBase;
    if (base === "female-default" || base === "twink-default") {
      setCustomBase(base);
    }
    const phrases = selected.keyPhrases ?? [];
    setCustomPhrase1(phrases[0] ?? "");
    setCustomPhrase2(phrases[1] ?? "");
    setCustomPhrase3(phrases[2] ?? "");
    const scenes = selected.scenes ?? [];
    setCustomScene1Title(scenes[0]?.title ?? "");
    setCustomScene1Body(scenes[0]?.body ?? "");
    setCustomScene2Title(scenes[1]?.title ?? "");
    setCustomScene2Body(scenes[1]?.body ?? "");
    setCustomScene3Title(scenes[2]?.title ?? "");
    setCustomScene3Body(scenes[2]?.body ?? "");
    setMediaBase(selected.mediaBase ?? "");
    setClipIdle(selected.mediaOverrides?.idle ?? "");
    setClipTeasing(selected.mediaOverrides?.teasing ?? "");
    setClipPlayful(selected.mediaOverrides?.playful ?? "");
    setClipAroused(selected.mediaOverrides?.aroused ?? "");
    setShowCreate(true);
  };

  const collectCustomFormPayload = () => {
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
    return { keyPhrases, scenes };
  };

  const applyCustomOption = (updated: {
    id: string;
    displayName: string;
    defaultVersion?: string;
    avatarBase?: string;
    energyLabel?: string;
    mediaBase?: string;
    mediaOverrides?: LiveCharacterOption["mediaOverrides"];
    clips?: LiveCharacterOption["clips"];
    visibility?: string;
    baseModelId?: string;
    appearance?: string;
    energy?: string;
    clothing?: string;
    keyPhrases?: string[];
    scenes?: LiveCharacterOption["scenes"];
    featured?: boolean;
  }) => {
    const option: LiveCharacterOption = {
      id: updated.id,
      displayName: updated.displayName,
      defaultVersion: updated.defaultVersion ?? "custom-v2",
      kind: "custom",
      avatarBase: updated.avatarBase,
      energyLabel: updated.energyLabel,
      mediaBase: updated.mediaBase,
      mediaOverrides: updated.mediaOverrides,
      clips: updated.clips,
      mine: true,
      visibility: updated.visibility ?? "private",
      baseModelId: updated.baseModelId,
      appearance: updated.appearance,
      energy: updated.energy,
      clothing: updated.clothing,
      keyPhrases: updated.keyPhrases,
      scenes: updated.scenes,
      featured: updated.featured === true,
    };
    setCharacters((prev) => {
      if (prev.some((c) => c.id === option.id)) {
        return prev.map((c) => (c.id === option.id ? { ...c, ...option } : c));
      }
      return [option, ...prev];
    });
    return option;
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
      const { keyPhrases, scenes } = collectCustomFormPayload();

      // Edit path — PATCH identity/vibe/scenes (auth fixed)
      if (editingCustomId) {
        const updated = await updateCustomCharacter(
          editingCustomId,
          {
            name: customName.trim(),
            appearance: customAppearance.trim(),
            energy: customEnergy.trim() || undefined,
            clothing: customClothing.trim() || undefined,
            keyPhrases: keyPhrases.length ? keyPhrases : null,
            scenes: scenes.length ? scenes : null,
            mediaBase: mediaBase.trim() ? mediaBase.trim() : null,
            mediaOverrides: buildMediaOverrides() ?? null,
          },
          account.token,
        );
        applyCustomOption({
          ...updated,
          appearance: updated.appearance ?? customAppearance.trim(),
          energy: updated.energy ?? customEnergy.trim(),
          clothing: updated.clothing ?? customClothing.trim(),
          keyPhrases: updated.keyPhrases ?? keyPhrases,
          scenes: updated.scenes ?? scenes,
        });
        setCharacter(updated.id);
        replaceCharacterInUrl(updated.id);
        setShowCreate(false);
        resetCustomForm();
        flashCopy(`${updated.displayName} updated · private My Character`);
        return;
      }

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
      applyCustomOption({
        ...created,
        appearance: customAppearance.trim(),
        energy: customEnergy.trim() || created.energyLabel,
        clothing: customClothing.trim() || undefined,
        keyPhrases,
        scenes,
      });
      setCharacter(created.id);
      replaceCharacterInUrl(created.id);
      setShowCreate(false);
      setJustCreated({ id: created.id, name: created.displayName });
      resetCustomForm();
      flashCopy(`${created.displayName} saved · private My Character`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingCustomId
            ? "Failed to update My Character"
            : "Failed to create My Character",
      );
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
      const updated = await updateCustomCharacter(
        selected.id,
        {
          mediaBase: mediaBase.trim() ? mediaBase.trim() : null,
          mediaOverrides: buildMediaOverrides() ?? null,
        },
        account?.token,
      );
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
    if (!account?.token) {
      setError("Sign in to upload clips");
      setShowAccount(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const result = await uploadCharacterClip(
        selected.id,
        emotion,
        file,
        account.token,
      );
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
    if (!account?.token) {
      setError("Sign in to upload clips");
      setShowAccount(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const files = Array.from(fileList);
      const result = await uploadCharacterClipsBatch(
        selected.id,
        files,
        account.token,
      );
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
      if (editingCustomId === selected.id) {
        setShowCreate(false);
        resetCustomForm();
      }
      flashCopy(`Deleted ${selected.displayName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete character");
    }
  };

  /** Clone a private My Character — new id, same mind fields (not clips by default). */
  const handleDuplicateCustom = async (sourceId?: string) => {
    if (!account?.token) {
      setError("Sign in to duplicate a My Character");
      setShowAccount(true);
      return;
    }
    const used = characters.filter((c) => c.mine === true).length;
    if (used >= customsLimit) {
      setError(`Cap full (${customsLimit}). Delete a model or upgrade for more slots.`);
      return;
    }
    const selected = characters.find((c) => c.id === (sourceId ?? character));
    if (!selected || selected.kind !== "custom") {
      setError("Select a My Character to duplicate");
      return;
    }
    const appearance =
      selected.appearance?.trim() ||
      selected.energyLabel?.trim() ||
      "Private custom mind — fill identity after duplicate.";
    if (appearance.length < 12) {
      setError("Source model is missing identity — Edit it first, then duplicate.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const baseName = selected.displayName.replace(/\s*\(copy\)\s*$/i, "").trim() || "My model";
      const created = await createCustomCharacter(
        {
          name: `${baseName} (copy)`.slice(0, 80),
          appearance: appearance.slice(0, 2000),
          energy: (selected.energy || selected.energyLabel || "").trim() || undefined,
          clothing: selected.clothing?.trim() || undefined,
          baseModelId: selected.baseModelId || selected.avatarBase,
          avatarBase:
            selected.avatarBase === "female-default" || selected.avatarBase === "twink-default"
              ? selected.avatarBase
              : undefined,
          keyPhrases: selected.keyPhrases?.length ? selected.keyPhrases : undefined,
          scenes: selected.scenes?.length ? selected.scenes : undefined,
        },
        account.token,
      );
      applyCustomOption({
        ...created,
        appearance,
        energy: selected.energy || selected.energyLabel,
        clothing: selected.clothing,
        keyPhrases: selected.keyPhrases,
        scenes: selected.scenes,
      });
      setCharacter(created.id);
      replaceCharacterInUrl(created.id);
      setJustCreated({ id: created.id, name: created.displayName });
      flashCopy(`${created.displayName} · duplicated (private)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = (overrideText?: string) => {
    const ws = wsRef.current;
    const text = (overrideText ?? input).trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text || sending) return;

    setSendPulse(true);
    window.setTimeout(() => setSendPulse(false), 420);
    // Soft “it landed” cue without noise
    flashCopy(text.length <= 24 ? `Sent · ${text}` : "Sent · heat delivered");

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
      return;
    }
    // Esc clears draft without killing the session
    if (e.key === "Escape" && input.trim()) {
      e.preventDefault();
      setInput("");
      clearComposerDraft(character);
      return;
    }
  };

  const sessionActive = status === "ready" || status === "connecting" || restarting;
  const canSend = status === "ready" && !sending && input.trim().length > 0;
  const selectedLive =
    characters.find((c) => c.id === (activeCharacterId ?? character)) ??
    characters.find((c) => c.id === character) ??
    null;
  const incomingQuery = incomingQueryRef.current;
  const bootIdentity = resolveChatBootIdentity({
    queryCharacterId: incomingQuery?.characterId,
    queryConsumed: deepLinkHandledRef.current,
    selectedCharacterId: character,
    activeCharacterId,
    liveCharacterName: characterName,
    selectedDisplayName: selectedLive?.displayName,
    savedSession,
  });
  const headerCharacterName = bootIdentity.displayName;
  const headerMind = bootIdentity.showMind
    ? mindFingerprint(
        bootIdentity.intendedCharacterId ?? activeCharacterId ?? character,
      )
    : null;
  const selectedOpening = bootIdentity.showMind
    ? selectedLive?.openingMessage?.trim() ||
      FALLBACK_CHARACTERS.find(
        (c) =>
          c.id ===
          (bootIdentity.intendedCharacterId ?? activeCharacterId ?? character),
      )?.openingMessage ||
      null
    : null;
  const showSavedResumeChrome =
    !!savedSession &&
    !bootIdentity.pendingRequested &&
    savedSession.characterId ===
      (bootIdentity.intendedCharacterId ?? character);
  const chatPresenceSkin = resolvePresenceSkin(
    avatarState?.presenceSkin,
    activeCharacterId ?? character,
  );
  const assistantBubbleBase = presenceBubbleClass(chatPresenceSkin);
  const dnaBubbleAsst = dnaAssistantBubbleClass(
    modeState?.dnaTreeNodeId,
    modeState?.dnaTreeLabel,
  );
  const assistantBubbleClass = dnaBubbleAsst || assistantBubbleBase;
  const dnaBubbleUser = dnaUserBubbleClass(
    modeState?.dnaTreeNodeId,
    modeState?.dnaTreeLabel,
  );
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

  const liveBand =
    status === "ready" ? energyBandFromAvatar(avatarState) : ("idle" as EnergyBand);
  const dnaNodeLive =
    status === "ready" ? modeState?.dnaTreeNodeId : null;
  const dnaLabelLive =
    status === "ready" ? modeState?.dnaTreeLabel : null;
  const dnaLevel = dnaTreeHeatLevel(dnaNodeLive, dnaLabelLive);
  const roomWash = liveRoomWashClass(liveBand, dnaNodeLive, dnaLabelLive);
  const heatDepth = heatDepthFromMessages(messages.length);
  const dnaChrome =
    status === "ready" ? dnaChromeClass(dnaNodeLive, dnaLabelLive) : "";
  const bandChrome =
    !dnaChrome && status === "ready" && liveBand === "edge"
      ? "border-b-rose-400/40 shadow-[0_8px_28px_-12px_rgba(244,63,94,0.35)]"
      : !dnaChrome && status === "ready" && liveBand === "play"
        ? "border-b-amber-400/30"
        : !dnaChrome && status === "ready" && liveBand === "tease"
          ? "border-b-brand-accent/35"
          : "";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${roomWash}`}
      />

      <SiteChrome
        active="chat"
        hideContinue={status === "ready" || status === "connecting"}
        title={headerCharacterName ? `Chat · ${headerCharacterName}` : "Live chat"}
        subtitle={
          [
            headerMind?.tag,
            status === "ready" && dnaLevel >= 0
              ? `DNA · ${dnaLabelLive || dnaNodeLive}`
              : status === "ready" && liveBand !== "idle"
                ? liveBand
                : null,
            statusLabel,
          ]
            .filter(Boolean)
            .join(" · ") || null
        }
        className={`pt-[env(safe-area-inset-top,0px)] transition-[box-shadow,border-color] duration-500 ${
          dnaChrome || bandChrome
        }`}
        trailing={
          <>
            {status === "ready" && resumeCode ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(resumeCode).then(
                    () => flashCopy(`Code ${resumeCode}`),
                    () => flashCopy(resumeCode),
                  );
                }}
                className="max-w-[7.5rem] truncate rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] text-amber-100"
                title="Copy resume code"
              >
                {resumeCode}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-muted">
                <StatusDot status={status} />
                {statusLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowAccount((v) => !v)}
              className={`text-[11px] ${
                showAccount ? "text-brand-accent" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              {account ? `@${account.handle}` : "Sign in"}
            </button>
          </>
        }
      />
      {copyNotice && (
        <p
          className="border-b border-brand-border/50 bg-brand-bg/80 px-3 py-1 text-center text-[11px] text-brand-accent sm:hidden"
          role="status"
        >
          {copyNotice}
        </p>
      )}

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 pt-3 sm:px-4 sm:pt-5">
        <HintRail className="mb-3">
          <NetworkOfflineBanner />
          <SessionAuthBanner
            onInvalidated={() => {
              setAccount(null);
              setAccountSessions([]);
              setAccountEmailLinked(null);
            }}
          />
          <PushEnableHint
            accountToken={account?.token}
            hasResumeCode={!!resumeCode || !!savedSession?.resumeCode}
          />
          <InstallAppHint />
          <SoftSupportHint
            hasEngagement={
              messages.length >= 4 || !!resumeCode || !!savedSession?.resumeCode
            }
            dnaHeat={
              !!modeState?.dnaTreeNodeId &&
              /edge|deny|release|gate|tease/i.test(
                modeState.dnaTreeLabel || modeState.dnaTreeNodeId || "",
              )
            }
          />
        </HintRail>
        <MyCharacterWinToast
          show={!!justCreated && status === "idle" && !sessionActive}
          characterId={justCreated?.id}
          characterName={justCreated?.name}
          customsLimit={customsLimit}
          onStart={() => {
            if (!justCreated) return;
            setCharacter(justCreated.id);
            void startSession(justCreated.id);
          }}
          onStartEdge={() => {
            if (!justCreated) return;
            setCharacter(justCreated.id);
            setSessionMode("edge_pace");
            void startSession(justCreated.id, { sessionMode: "edge_pace" });
          }}
          onDismiss={() => setJustCreated(null)}
        />
        {pauseSnapshot && status === "idle" && (
          <SessionPausedBanner
            characterId={pauseSnapshot.characterId}
            characterName={pauseSnapshot.characterName}
            resumeCode={pauseSnapshot.resumeCode}
            messageCount={pauseSnapshot.messageCount}
            heatDepth={pauseSnapshot.heatDepth}
            heatChips={pauseSnapshot.heatChips}
            recapLine={pauseSnapshot.recapLine}
            dnaTreeLabel={pauseSnapshot.dnaTreeLabel}
            dnaTreeNodeId={pauseSnapshot.dnaTreeNodeId}
            baseModelId={
              characters.find((c) => c.id === pauseSnapshot.characterId)?.baseModelId ||
              characters.find((c) => c.id === pauseSnapshot.characterId)?.avatarBase ||
              (pauseSnapshot.characterId.startsWith("custom-")
                ? undefined
                : pauseSnapshot.characterId)
            }
            isMine={
              characters.find((c) => c.id === pauseSnapshot.characterId)?.mine === true ||
              pauseSnapshot.characterId.startsWith("custom-")
            }
            onResume={() => {
              const snap = pauseSnapshot;
              setPauseSnapshot(null);
              setCharacter(snap.characterId);
              const dnaPower =
                !!(snap.dnaTreeLabel || snap.dnaTreeNodeId) ||
                snap.heatDepth === "edge" ||
                snap.heatDepth === "deep" ||
                snap.heatDepth === "locked";
              void (async () => {
                try {
                  if (snap.resumeCode) {
                    if (dnaPower) setSessionMode("edge_pace");
                    const session = await resumeByCode(snap.resumeCode, {
                      sessionMode: dnaPower ? "edge_pace" : undefined,
                    });
                    if (
                      session.sessionMode === "edge_pace" ||
                      session.sessionMode === "normal"
                    ) {
                      setSessionMode(session.sessionMode);
                    }
                    await openLiveSession(session, { forceRehydrate: true });
                    if (dnaPower) {
                      setCopyNotice("DNA power reclaim · Edge Pace + heat restored");
                      window.setTimeout(() => setCopyNotice(null), 3200);
                    }
                    return;
                  }
                  await resumeLastSession();
                } catch {
                  void startSession(
                    snap.characterId,
                    dnaPower ? { sessionMode: "edge_pace" } : undefined,
                  );
                }
              })();
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
          dnaPower={
            !!modeState?.dnaTreeNodeId ||
            !!modeState?.dnaTreeLabel ||
            sessionMode === "edge_pace"
          }
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
                  <Link
                    href="/account#my-models"
                    className="rounded-lg border border-violet-400/40 px-3 py-1 text-xs text-violet-100 hover:border-violet-300/55"
                  >
                    My models
                  </Link>
                  <Link
                    href="/?filter=owned"
                    className="rounded-lg border border-brand-border px-3 py-1 text-xs text-brand-muted hover:border-brand-accent"
                  >
                    Gallery models
                  </Link>
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
                    {accountSessions.map((s) => {
                      const mind = mindFingerprint(s.characterId);
                      const nick =
                        s.characterName?.trim().split(/\s+/)[0] || "chat";
                      return (
                      <li
                        key={s.sessionId}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-border/60 bg-brand-bg px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 text-brand-text">
                          {s.characterName}
                          {mind ? (
                            <span className="text-brand-accent"> · {mind.tag}</span>
                          ) : null}
                          <span className="text-brand-muted">
                            {" "}
                            · {s.messageCount} msgs
                          </span>
                          {s.resumeCode && (
                            <span className="ml-1 font-mono text-amber-200/80">
                              {s.resumeCode}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleAccountSessionResume(s.sessionId)}
                          className="btn-primary ml-auto min-h-0 px-2.5 py-1 text-[10px]"
                        >
                          Continue · {nick}
                        </button>
                      </li>
                      );
                    })}
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 pb-3 lg:flex-row lg:items-stretch lg:gap-4">
          {/* LiveKit stays mounted even when collapsed so avatar state keeps syncing */}
          <div className="sr-only" aria-hidden>
            <LiveKitAvatarSync
              livekit={livekit}
              onAvatarSync={handleAvatarSync}
              onStatusChange={setLivekitRoomStatus}
            />
          </div>

          <div className={`w-full shrink-0 overflow-hidden rounded-2xl border border-brand-border bg-black shadow-card lg:h-auto lg:max-h-none lg:w-72 lg:max-w-[18.5rem] lg:self-stretch ${
            sessionActive ? "h-[18vh] max-h-36" : "h-[22vh] max-h-44"
          }`}>
            <AvatarVideo
              avatar={avatarState}
              characterName={characterName ?? headerCharacterName}
              characterId={activeCharacterId ?? character}
              dnaTreeNodeId={modeState?.dnaTreeNodeId}
              dnaTreeLabel={modeState?.dnaTreeLabel}
              fill
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-panel/95 shadow-card backdrop-blur-sm">
            <div className="shrink-0 space-y-2 border-b border-brand-border/60 p-2.5 sm:p-3">
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
              {sessionActive ? (
                <p className="min-w-0 truncate text-sm font-medium text-brand-text">
                  {headerCharacterName || characterName || "Live"}
                  {headerMind ? (
                    <span className="ml-1.5 text-[11px] font-normal text-brand-muted">
                      · {headerMind.tag}
                    </span>
                  ) : null}
                </p>
              ) : (
              <>
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
                disabled={restarting}
                className="field min-h-touch min-w-0 flex-1 text-sm disabled:opacity-50"
              >
                {(() => {
                  const mine = characters.filter((c) => c.mine === true);
                  const signatures = characters.filter((c) => c.kind === "default");
                  const otherCustom = characters.filter(
                    (c) => c.kind === "custom" && c.mine !== true,
                  );
                  const renderOpt = (opt: (typeof characters)[0]) => {
                    const mind = mindFingerprint(opt.id);
                    return (
                      <option key={opt.id} value={opt.id}>
                        {opt.mine ? "◆ " : opt.kind === "custom" ? "✦ " : ""}
                        {opt.displayName}
                        {opt.mine ? " · mine" : ""}
                        {mind ? ` · ${mind.tag}` : ""}
                        {opt.defaultVersion ? ` (${opt.defaultVersion})` : ""}
                      </option>
                    );
                  };
                  return (
                    <>
                      {character &&
                        !characters.some((c) => c.id === character) && (
                          <option value={character}>Connecting…</option>
                        )}
                      {mine.length > 0 && (
                        <optgroup label="My models">{mine.map(renderOpt)}</optgroup>
                      )}
                      {signatures.length > 0 && (
                        <optgroup label="Signature">{signatures.map(renderOpt)}</optgroup>
                      )}
                      {otherCustom.length > 0 && (
                        <optgroup label="Custom">{otherCustom.map(renderOpt)}</optgroup>
                      )}
                    </>
                  );
                })()}
              </select>
              </>
              )}
              </div>
              </div>


              <div className="flex flex-wrap items-center gap-2">
              {!sessionActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className={`min-h-0 px-3 py-2 text-xs sm:text-sm ${
                      showSavedResumeChrome ? "btn-ghost" : "btn-primary"
                    }`}
                  >
                    {showSavedResumeChrome ? "Start new" : "Start"}
                  </button>
                  {showSavedResumeChrome && !pauseSnapshot && (
                    <button
                      type="button"
                      onClick={() => void resumeLastSession()}
                      className="btn-primary min-h-0 px-3 py-2 text-xs sm:text-sm"
                      title={`Resume ${savedSession.characterName ?? savedSession.characterId}`}
                    >
                      Resume
                    </button>
                  )}
                  <OverflowMenu align="left">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        setSessionMode((m) => (m === "edge_pace" ? "normal" : "edge_pace"))
                      }
                    >
                      {sessionMode === "edge_pace" ? "Mode · Edge Pace" : "Mode · Normal"}
                    </button>
                    <label className="cursor-pointer">
                      {importBusy ? "Importing…" : "Import chat"}
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
                    <a href="/models/studio" role="menuitem">
                      Character settings
                    </a>
                    {characters.some(
                      (c) => c.id === character && c.kind === "custom" && c.mine !== false,
                    ) ? (
                      <>
                        <a
                          href={`/models/studio/edit/${encodeURIComponent(character)}`}
                          role="menuitem"
                        >
                          Edit model
                        </a>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={creating}
                          onClick={() => void handleDuplicateCustom()}
                        >
                          Duplicate
                        </button>
                      </>
                    ) : null}
                    {characters.some((c) => c.id === character && c.kind === "custom") ? (
                      <button type="button" role="menuitem" onClick={handleDeleteCustom}>
                        Delete model
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void shareCharacterLink(false)}
                    >
                      {canNativeShare() ? "Share card" : "Copy card link"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void shareCharacterLink(true)}
                    >
                      {canNativeShare() ? "Share start" : "Copy start link"}
                    </button>
                    <a href={`/character/${encodeURIComponent(character)}`} role="menuitem">
                      Full card
                    </a>
                  </OverflowMenu>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startNewSession}
                    disabled={status === "connecting" || restarting}
                    className="btn-primary min-h-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                  >
                    {restarting ? "…" : "Switch"}
                  </button>
                  <button
                    type="button"
                    onClick={endSession}
                    disabled={status === "connecting" || restarting}
                    className="btn-ghost min-h-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                  >
                    End
                  </button>
                  <OverflowMenu align="left">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={status === "connecting" || restarting}
                      onClick={() => void shareCharacterLink(true)}
                    >
                      {canNativeShare() ? "Share character" : "Copy character link"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={status !== "ready" || !resumeCode}
                      onClick={() => void sharePrivateResumeLink()}
                    >
                      {resumeCode ? `Resume ${resumeCode}` : "Resume code"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!sessionId || !wsToken || messages.length === 0}
                      onClick={() => void exportChat("json")}
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!sessionId || !wsToken || messages.length === 0}
                      onClick={() => void exportChat("md")}
                    >
                      Export Markdown
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={messages.length === 0 && !(sessionId && wsToken)}
                      onClick={() => void shareChatMarkdown()}
                    >
                      {canNativeShare() ? "Share Markdown" : "Copy Markdown"}
                    </button>
                  </OverflowMenu>
                </>
              )}
              {bandFlash ? (
                <span
                  className={`animate-fade-in rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${energyBandBadgeClass(bandFlash)}`}
                >
                  {energyBandLabel(bandFlash)}
                </span>
              ) : null}
              </div>
            </div>
            </div>

            <div
              ref={messagesScrollRef}
              onScroll={onMessagesScroll}
              className={`relative flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4 ${transcriptAmbient}`}
            >
              <RejoinRecapToast
                show={rejoinRecap.show && status === "ready"}
                characterId={activeCharacterId ?? character}
                characterName={characterName ?? headerCharacterName}
                recapLine={rejoinRecap.line}
                priorNotes={priorNotes}
                dnaTreeLabel={modeState?.dnaTreeLabel}
                dnaTreeNodeId={modeState?.dnaTreeNodeId}
                onDismiss={() => setRejoinRecap((r) => ({ ...r, show: false }))}
              />
              <div className="pointer-events-none absolute inset-x-3 top-2 z-10 sm:inset-x-4">
                <div className="pointer-events-auto">
              <SessionWinToast
                show={status === "ready"}
                characterId={activeCharacterId ?? character}
                characterName={characterName ?? headerCharacterName}
                resumeCode={resumeCode}
                messageCount={messages.length}
                dnaTreeLabel={modeState?.dnaTreeLabel}
                dnaTreeNodeId={modeState?.dnaTreeNodeId}
                heatDepth={heatDepth.label}
                heatChips={modeState?.phaseChips}
                recapLine={
                  recapFromSessionNotes(sessionNotes) ||
                  getResumeForCharacter(activeCharacterId ?? character)?.recapLine
                }
                baseModelId={
                  characters.find((c) => c.id === (activeCharacterId ?? character))
                    ?.baseModelId ||
                  characters.find((c) => c.id === (activeCharacterId ?? character))
                    ?.avatarBase ||
                  (activeCharacterId ?? character)
                }
                isMine={
                  characters.find((c) => c.id === (activeCharacterId ?? character))
                    ?.mine === true ||
                  (activeCharacterId ?? character).startsWith("custom-")
                }
              />
                </div>
              </div>
              {messages.length === 0 && !isTyping && (
                <div className="px-2 py-6 text-center sm:py-8">
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
                  {status === "ready" && isTyping && (
                    <p className="mt-2 text-xs text-brand-accent animate-pulse">
                      {headerCharacterName?.split(/\s+/)[0] || "They"}’s opening for you…
                    </p>
                  )}
                  {status !== "connecting" && !restarting && (
                  <p className="text-sm text-brand-muted">
                    {status === "ready"
                      ? headerCharacterName
                        ? `${headerCharacterName} is live.`
                        : "Live — they should greet you first."
                      : showSavedResumeChrome
                          ? `Welcome back — Resume or Start new.`
                          : headerCharacterName
                            ? `Ready for ${headerCharacterName}. Hit Start.`
                            : bootIdentity.pendingRequested ||
                                (incomingQuery?.autostart && incomingQuery.characterId)
                              ? "Connecting…"
                              : "Pick a character, then Start."}
                  </p>
                  )}
                  {status !== "ready" && status !== "connecting" && !restarting && headerMind && (
                    <p className="mx-auto mt-2 max-w-sm text-[11px] text-brand-soft">
                      {headerMind.tag}
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
                  !isTyping &&
                  !input.trim() &&
                  modeState?.mode !== "edge_pace";
                const showUseAgain =
                  isLast &&
                  msg.role === "user" &&
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
                        ? `bg-brand-accent text-white shadow-glow-sm ${dnaBubbleUser} ${sendPulse && isLast ? "ring-2 ring-white/30" : ""}`
                        : `border text-brand-text ${assistantBubbleClass} ${
                            msg.streaming
                              ? dnaLevel >= 0
                                ? "ring-1 ring-violet-400/40"
                                : "ring-1 ring-brand-accent/30"
                              : arrivalId === msg.id
                                ? dnaLevel >= 0
                                  ? "ring-2 ring-violet-400/55 shadow-glow-sm"
                                  : "ring-2 ring-brand-accent/50 shadow-glow-sm"
                                : ""
                          }`
                    }`}
                  >
                    {showMindTag && (
                      <p
                        className={`mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${
                          dnaLevel >= 0 ? "text-violet-200/90" : "text-brand-accent/80"
                        }`}
                      >
                        {headerCharacterName?.split(/\s+/)[0] || "Them"}
                        {" · "}
                        {headerMind!.tag}
                        {dnaLevel >= 0 && modeState?.dnaTreeLabel
                          ? ` · DNA ${String(modeState.dnaTreeLabel).split(/\s+/)[0]}`
                          : dnaLevel >= 0 && modeState?.dnaTreeNodeId
                            ? ` · DNA ${String(modeState.dnaTreeNodeId).split(/\s+/)[0]}`
                            : ""}
                      </p>
                    )}
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    {msg.streaming && (
                      <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-brand-accent align-middle" />
                    )}
                  </div>
                  {showUseAgain && (
                    <button
                      type="button"
                      onClick={() => {
                        setInput(msg.content);
                        window.setTimeout(() => inputRef.current?.focus(), 40);
                      }}
                      className="mt-1 text-[10px] text-brand-muted hover:text-brand-accent"
                    >
                      Use again
                    </button>
                  )}
                  {showAfterglow && (
                    <div className="max-w-[90%] sm:max-w-[80%]">
                      <AfterglowChips
                        characterId={activeCharacterId ?? character}
                        disabled={sending}
                        intense={
                          modeState?.mode === "edge_pace" &&
                          modeState.phase === "almost"
                        }
                        heatDepth={heatDepth.label}
                        dnaTreeLabel={modeState?.dnaTreeLabel}
                        dnaTreeNodeId={modeState?.dnaTreeNodeId}
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
                  dnaTreeNodeId={modeState?.dnaTreeNodeId}
                  dnaTreeLabel={modeState?.dnaTreeLabel}
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
              className={`sticky bottom-0 z-20 border-t border-brand-border/80 bg-brand-panel/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[box-shadow,border-color] duration-500 sm:p-3 sm:pb-3 ${edgePaceComposerClass(modeState, status)} ${
                sendPulse ? "ring-1 ring-inset ring-brand-accent/40" : ""
              } ${arrivalId ? "ring-1 ring-inset ring-brand-accent/25" : ""}`}
            >
              {modeState?.mode === "edge_pace" && status === "ready" && (
                <EdgePaceStrip
                  modeState={modeState}
                  tickOffset={modeTick}
                  canFire={!sending && !isTyping}
                  onSeed={(text) => {
                    setInput((prev) => {
                      const p = prev.trim();
                      if (!p) return text;
                      return `${p} ${text}`;
                    });
                    window.setTimeout(() => inputRef.current?.focus(), 40);
                  }}
                  onFire={(text) => sendMessage(text)}
                />
              )}
              {status !== "ready" && (
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
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
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
                        : dnaLevel >= 3
                          ? `Stay on DNA · ${dnaLabelLive || "Edge"}… (Enter)`
                          : dnaLevel >= 0
                            ? `Climb with ${
                                (headerCharacterName || "them").split(/\s+/)[0]
                              }… (Enter)`
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
                  rows={2}
                  enterKeyHint="send"
                  autoComplete="off"
                  className={`field min-h-touch flex-1 resize-none py-2.5 text-base disabled:opacity-50 sm:min-h-[2.75rem] sm:text-sm ${
                    input.trim() && status !== "ready" ? "field-has-draft" : ""
                  } ${
                    modeState?.mode === "edge_pace" && modeState.phase === "almost" && status === "ready"
                      ? "border-rose-400/50 focus:ring-rose-400/30"
                      : modeState?.mode === "edge_pace" && modeState.phase === "breathe" && status === "ready"
                        ? "border-sky-400/40 focus:ring-sky-400/25"
                        : status === "ready" && dnaLevel >= 0
                          ? dnaComposerClass(dnaNodeLive, dnaLabelLive)
                          : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  className={`btn-primary min-h-touch shrink-0 px-4 disabled:opacity-50 sm:min-h-[2.75rem] sm:px-5 ${
                    sendPulse ? "scale-95 ring-2 ring-white/40 shadow-glow" : ""
                  } ${sending ? "opacity-80" : ""} ${
                    modeState?.mode === "edge_pace" && modeState.phase === "almost"
                      ? "ring-2 ring-rose-300/50"
                      : modeState?.mode === "edge_pace" && modeState.phase === "hold"
                        ? "ring-1 ring-amber-300/40"
                        : modeState?.mode === "edge_pace" && modeState.phase === "breathe"
                          ? "ring-1 ring-sky-300/40"
                          : ""
                  }`}
                >
                  {sending
                    ? "…"
                    : modeState?.mode === "edge_pace"
                      ? modeState.phase === "almost"
                        ? "Hold…"
                        : modeState.phase === "hold"
                          ? "Stay…"
                          : modeState.phase === "breathe"
                            ? "Soft…"
                            : modeState.phase === "build"
                              ? "Build…"
                              : "Send"
                      : heatDepth.label === "locked"
                        ? "Stay…"
                        : heatDepth.label === "deep"
                          ? "Push…"
                          : heatDepth.label === "edge"
                            ? "Edge…"
                            : "Send"}
                </button>
              </div>
              {status === "ready" && (
                <div className="mt-1.5 hidden flex-wrap items-center justify-between gap-2 text-[9px] text-brand-soft sm:flex">
                  <p>
                    Enter send · Shift+Enter line · Esc clear draft
                    {input.trim() ? " · draft auto-saves" : ""}
                  </p>
                  {input.trim().length > 0 && (
                    <p
                      className={`font-mono tabular-nums ${
                        input.trim().length > 400
                          ? "text-rose-200/90"
                          : input.trim().length > 180
                            ? "text-amber-200/80"
                            : "text-brand-soft"
                      }`}
                    >
                      {input.trim().length}
                      {input.trim().length > 180
                        ? input.trim().length > 400
                          ? " · novel heat"
                          : " · long pour"
                        : " · short & filthy ok"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
          </div>
        </div>

        <footer className="mt-auto hidden flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-brand-border/40 py-3 text-[11px] text-brand-muted sm:flex sm:text-xs">
          <span className="inline-flex items-center gap-1.5 sm:hidden">
            <StatusDot status={status} />
            {statusLabel}
          </span>
          <span className="hidden min-w-0 truncate sm:inline">
            {status === "ready" && headerMind ? (
              <>
                <span className="text-brand-accent">{headerMind.tag}</span>
                {" · "}
                <span className="text-brand-muted">{headerMind.blurb}</span>
              </>
            ) : (
              "Uncensored 21+ · Procharacters.cloud"
            )}
          </span>
          {sessionId && <span className="font-mono">#{sessionId.slice(0, 8)}</span>}
          <span className="sm:hidden">
            {status === "ready" && headerMind ? headerMind.tag : "21+ · KGC"}
          </span>
        </footer>
      </div>

    </main>
  );
}