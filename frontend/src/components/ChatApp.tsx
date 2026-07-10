"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarPanel } from "@/components/AvatarPanel";
import { AvatarVideo } from "@/components/AvatarVideo";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  claimSession,
  createCustomCharacter,
  createSession,
  deleteCustomCharacter,
  listAccountSessions,
  listLiveCharacters,
  loginAccount,
  logoutAccount,
  registerAccount,
  resumeAccountSession,
  resumeByCode,
  resumeSession,
  updateCustomCharacter,
  type AccountSessionSummary,
} from "@/lib/api";
import {
  clearStoredAccount,
  loadStoredAccount,
  saveStoredAccount,
  type StoredAccount,
} from "@/lib/account-storage";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession,
} from "@/lib/session-storage";
import {
  buildCharacterShareUrl,
  buildResumeCodeShareUrl,
  copyText,
  parseShareQuery,
  replaceCharacterInUrl,
} from "@/lib/share-links";
import type {
  AvatarState,
  CharacterId,
  ChatMessage,
  ConnectionStatus,
  LiveCharacterOption,
  LiveKitJoinInfo,
  MemoryMessage,
} from "@/lib/types";

const FALLBACK_CHARACTERS: LiveCharacterOption[] = [
  {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.2.0",
    kind: "default",
  },
  {
    id: "female-default",
    displayName: "Female Default",
    defaultVersion: "v1.2.0",
    kind: "default",
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
  const [customBase, setCustomBase] = useState<"twink-default" | "female-default">("twink-default");
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
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSessions, setAccountSessions] = useState<AccountSessionSummary[]>([]);
  const [resumeCodeInput, setResumeCodeInput] = useState("");

  const handleAvatarSync = useCallback((avatar: AvatarState) => {
    setAvatarState(avatar);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingHistoryRef = useRef<ChatMessage[] | null>(null);
  const deepLinkHandledRef = useRef(false);

  const closeSocket = useCallback((sendEnd = true) => {
    const ws = wsRef.current;
    if (!ws) return;

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
    streamingIdRef.current = null;
    pendingHistoryRef.current = null;
  }, []);

  const refreshAccountSessions = useCallback(async (token: string) => {
    try {
      const sessions = await listAccountSessions(token);
      setAccountSessions(sessions);
    } catch {
      setAccountSessions([]);
    }
  }, []);

  const rememberSession = useCallback(
    (info: {
      sessionId: string;
      wsToken: string;
      characterId: string;
      characterName?: string | null;
    }) => {
      const stored: StoredSession = {
        sessionId: info.sessionId,
        wsToken: info.wsToken,
        characterId: info.characterId,
        characterName: info.characterName ?? undefined,
        savedAt: new Date().toISOString(),
      };
      saveStoredSession(stored);
      setSavedSession(stored);
    },
    [],
  );

  const endSession = useCallback(() => {
    // End on server but keep local resume credentials (memory is persisted server-side).
    closeSocket(true);
    if (sessionId && wsToken && (activeCharacterId || character)) {
      rememberSession({
        sessionId,
        wsToken,
        characterId: activeCharacterId ?? character,
        characterName,
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
    rememberSession,
    sessionId,
    wsToken,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => closeSocket(false);
  }, [closeSocket]);

  useEffect(() => {
    let cancelled = false;
    listLiveCharacters()
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
  }, []);

  useEffect(() => {
    setSavedSession(loadStoredSession());
    const storedAccount = loadStoredAccount();
    setAccount(storedAccount);
    if (storedAccount) {
      void refreshAccountSessions(storedAccount.token);
    }
  }, [refreshAccountSessions]);

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
            const name = (data.characterName as string) ?? null;
            setCharacterName(name);
            if (data.avatarState) {
              setAvatarState(data.avatarState as AvatarState);
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
            rememberSession({
              sessionId: session.sessionId,
              wsToken: session.wsToken,
              characterId: session.characterId,
              characterName: name,
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
            streamingIdRef.current = null;
            setSending(false);
            setIsTyping(false);

            if (avatarIntent) {
              setAvatarState(avatarIntent);
            }

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
            setAvatarState(data.avatarState as AvatarState);
            break;

          case "session_ended":
            setStatus("ended");
            closeSocket(false);
            break;

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
        setError("WebSocket connection failed");
        setStatus("error");
        setSending(false);
        setIsTyping(false);
        setRestarting(false);
      };

      ws.onclose = () => {
        wsRef.current = null;
        setSending(false);
        setIsTyping(false);
        setStatus((current) =>
          current === "ready" || current === "connecting" ? "ended" : current,
        );
        setRestarting(false);
      };
    },
    [closeSocket, rememberSession],
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
      },
    ) => {
      const history = (session.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content,
      }));
      pendingHistoryRef.current = history.length ? history : null;
      if (history.length) setMessages(history);
      setCharacter(session.characterId);
      setAvatarState(session.avatarState);
      setLivekit(session.livekit ?? null);
      setWsToken(session.wsToken);
      setResumeCode(session.resumeCode ?? null);
      const ws = new WebSocket(session.wsUrl);
      wsRef.current = ws;
      bindWebSocket(ws, {
        sessionId: session.sessionId,
        characterId: session.characterId,
        wsToken: session.wsToken,
      });
    },
    [bindWebSocket],
  );

  const connectSession = useCallback(
    async (characterId: CharacterId) => {
      setError(null);
      setStatus("connecting");
      pendingHistoryRef.current = null;

      const session = await createSession(characterId, account?.token);
      await openLiveSession(session);
    },
    [account?.token, openLiveSession],
  );

  const connectResumedSession = useCallback(
    async (stored: StoredSession) => {
      setError(null);
      setStatus("connecting");
      const session = await resumeSession(stored.sessionId, stored.wsToken);
      await openLiveSession(session);
    },
    [openLiveSession],
  );

  const startSession = async (characterId: CharacterId = character) => {
    clearSessionState();
    setCharacter(characterId);
    replaceCharacterInUrl(characterId);
    try {
      await connectSession(characterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStatus("error");
      setRestarting(false);
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

  // Deep-links: ?character=…&autostart=1  or  ?resume=CODE  or legacy ?session=&token=
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;
    if (characters.length === 0) return;

    const query = parseShareQuery(window.location.search);
    if (!query.characterId && !query.resumeCode && !(query.sessionId && query.token)) return;

    deepLinkHandledRef.current = true;

    if (query.resumeCode) {
      void (async () => {
        try {
          setStatus("connecting");
          const session = await resumeByCode(query.resumeCode!);
          await openLiveSession(session);
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
      if (query.autostart) {
        void startSession(query.characterId);
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
    const ok = await copyText(url);
    flashCopy(
      ok
        ? autostart
          ? "Autostart link copied"
          : "Character card link copied"
        : "Copy failed",
    );
  };

  const sharePrivateResumeLink = async () => {
    if (!resumeCode) {
      setError("Start or resume a session first — resume code not ready yet");
      return;
    }
    const url = buildResumeCodeShareUrl(resumeCode, {
      characterId: activeCharacterId ?? character,
    });
    const ok = await copyText(url);
    flashCopy(ok ? `Resume link copied (${resumeCode})` : "Copy failed");
  };

  const handleAccountAuth = async (mode: "login" | "register") => {
    setAccountBusy(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await registerAccount(accountHandle.trim(), accountPass)
          : await loginAccount(accountHandle.trim(), accountPass);
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
      await refreshAccountSessions(stored.token);
      if (sessionId) {
        try {
          const claimed = await claimSession(stored.token, sessionId);
          if (claimed.resumeCode) setResumeCode(claimed.resumeCode);
        } catch {
          /* optional claim */
        }
      }
      flashCopy(mode === "register" ? "Account created" : `Signed in as ${result.handle}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account auth failed");
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
      await openLiveSession(session);
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
      await openLiveSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume account session");
      setStatus("error");
    }
  };

  const startNewSession = async () => {
    setRestarting(true);
    setError(null);
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
    setCreating(true);
    setError(null);
    try {
      const created = await createCustomCharacter({
        name: customName.trim(),
        appearance: customAppearance.trim(),
        energy: customEnergy.trim() || undefined,
        clothing: customClothing.trim() || undefined,
        avatarBase: customBase,
        audience: customBase === "female-default" ? "straight" : "gay",
        mediaBase: mediaBase.trim() || undefined,
        mediaOverrides: buildMediaOverrides(),
      });
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
      setMediaBase("");
      setClipIdle("");
      setClipTeasing("");
      setClipPlayful("");
      setClipAroused("");
      setShowMediaAdvanced(false);
      flashCopy("Custom ready — clips attached");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom character");
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

  const handleDeleteCustom = async () => {
    const selected = characters.find((c) => c.id === character);
    if (!selected || selected.kind !== "custom") return;
    if (!window.confirm(`Delete custom character “${selected.displayName}”?`)) return;

    setError(null);
    try {
      await deleteCustomCharacter(selected.id);
      setCharacters((prev) => prev.filter((c) => c.id !== selected.id));
      setCharacter("twink-default");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete character");
    }
  };

  const sendMessage = () => {
    const ws = wsRef.current;
    const text = input.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text || sending) return;

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
  const statusLabel =
    status === "ready"
      ? "Connected"
      : status === "connecting" || restarting
        ? "Connecting…"
        : status === "ended"
          ? "Session ended"
          : status === "error"
            ? "Error"
            : "Disconnected";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="bg-gradient-to-r from-brand-text to-brand-accent bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          Procharacters.cloud
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-muted">
          <span>Naughty Syntax — v2.1 Live Chat</span>
          {copyNotice && <span className="text-brand-accent">· {copyNotice}</span>}
          <button
            type="button"
            onClick={() => setShowAccount((v) => !v)}
            className="ml-auto text-xs text-brand-accent hover:underline"
          >
            {account ? `@${account.handle}` : "Account"}
          </button>
        </div>

        {showAccount && (
          <div className="mt-3 rounded-xl border border-brand-border bg-brand-panel p-3">
            {account ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-brand-text">Signed in as <strong>@{account.handle}</strong></span>
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
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  placeholder="Handle"
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
                  disabled={accountBusy || accountHandle.trim().length < 3 || accountPass.length < 6}
                  onClick={() => void handleAccountAuth("login")}
                  className="rounded-lg bg-brand-accent px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  disabled={accountBusy || accountHandle.trim().length < 3 || accountPass.length < 6}
                  onClick={() => void handleAccountAuth("register")}
                  className="rounded-lg border border-brand-border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Register
                </button>
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
              Multi-device: sign in on any device, or share a resume code link — no raw tokens in URLs.
            </p>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-col gap-4 lg:flex-row">
        <div className="flex w-full flex-col gap-3 lg:max-w-xs">
          <AvatarVideo avatar={avatarState} characterName={characterName} />
          <AvatarPanel
            characterName={characterName}
            characterId={activeCharacterId}
            avatar={avatarState}
            status={status}
          />
          <LiveKitAvatarSync livekit={livekit} onAvatarSync={handleAvatarSync} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <section className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-panel p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="text-sm text-brand-muted" htmlFor="character">
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
                className="min-w-[12rem] flex-1 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text disabled:opacity-50 sm:flex-none"
              >
                {characters.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.kind === "custom" ? "✦ " : ""}
                    {opt.displayName}
                    {opt.defaultVersion ? ` (${opt.defaultVersion})` : ""}
                  </option>
                ))}
              </select>

              {!sessionActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim"
                  >
                    Start Session
                  </button>
                  {savedSession && (
                    <button
                      type="button"
                      onClick={() => void resumeLastSession()}
                      className="rounded-lg border border-brand-accent/60 bg-brand-accent/10 px-4 py-2 text-sm font-medium text-brand-text transition hover:border-brand-accent"
                      title={`Resume ${savedSession.characterName ?? savedSession.characterId}`}
                    >
                      Resume last chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreate((v) => !v)}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent"
                  >
                    {showCreate ? "Close" : "Create Custom"}
                  </button>
                  {characters.some((c) => c.id === character && c.kind === "custom") && (
                    <button
                      type="button"
                      onClick={handleDeleteCustom}
                      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 transition hover:border-red-400"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => shareCharacterLink(false)}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent"
                    title="Copy pretty character card link"
                  >
                    Share card
                  </button>
                  <button
                    type="button"
                    onClick={() => shareCharacterLink(true)}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent"
                    title="Copy link that auto-starts this character"
                  >
                    Share ▶
                  </button>
                  <a
                    href={`/character/${encodeURIComponent(character)}`}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-muted transition hover:border-brand-accent hover:text-brand-text"
                  >
                    Open card
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startNewSession}
                    disabled={status === "connecting" || restarting}
                    className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim disabled:opacity-50"
                  >
                    {restarting ? "Restarting…" : "Switch / New"}
                  </button>
                  <button
                    type="button"
                    onClick={endSession}
                    disabled={status === "connecting" || restarting}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent disabled:opacity-50"
                  >
                    End
                  </button>
                  <button
                    type="button"
                    onClick={() => shareCharacterLink(true)}
                    disabled={status === "connecting" || restarting}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent disabled:opacity-50"
                    title="Copy public character autostart link"
                  >
                    Share character
                  </button>
                  <button
                    type="button"
                    onClick={sharePrivateResumeLink}
                    disabled={status !== "ready" || !resumeCode}
                    className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 transition hover:border-amber-400 disabled:opacity-50"
                    title="Copy ?resume=CODE link — short code, no raw ws token"
                  >
                    {resumeCode ? `Copy resume (${resumeCode})` : "Copy resume"}
                  </button>
                </>
              )}
            </div>

            {showCreate && !sessionActive && (
              <div className="grid gap-2 rounded-lg border border-brand-border bg-brand-bg p-3">
                <p className="text-xs text-brand-muted">
                  Custom characters persist on the server volume. Share links work after create.
                  Video uses a default clip pack until custom footage is added.
                </p>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Name (e.g. Diego)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <textarea
                  value={customAppearance}
                  onChange={(e) => setCustomAppearance(e.target.value)}
                  placeholder="Appearance lock (body, hair, skin, face…)"
                  rows={3}
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <input
                  value={customEnergy}
                  onChange={(e) => setCustomEnergy(e.target.value)}
                  placeholder="Energy (optional — teasing, dominant, shy…)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <input
                  value={customClothing}
                  onChange={(e) => setCustomClothing(e.target.value)}
                  placeholder="Clothing focus (optional)"
                  className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-brand-muted" htmlFor="avatarBase">
                    Fallback pack
                  </label>
                  <select
                    id="avatarBase"
                    value={customBase}
                    onChange={(e) =>
                      setCustomBase(e.target.value as "twink-default" | "female-default")
                    }
                    className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                  >
                    <option value="twink-default">Twink clips</option>
                    <option value="female-default">Female clips</option>
                  </select>
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
                    {creating ? "Creating…" : "Save & Select"}
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
                    <div className="grid gap-1 sm:grid-cols-2">
                      <input
                        value={clipIdle}
                        onChange={(e) => setClipIdle(e.target.value)}
                        placeholder="idle clip URL (optional)"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                      />
                      <input
                        value={clipTeasing}
                        onChange={(e) => setClipTeasing(e.target.value)}
                        placeholder="teasing clip URL (optional)"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                      />
                      <input
                        value={clipPlayful}
                        onChange={(e) => setClipPlayful(e.target.value)}
                        placeholder="playful clip URL (optional)"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                      />
                      <input
                        value={clipAroused}
                        onChange={(e) => setClipAroused(e.target.value)}
                        placeholder="aroused clip URL (optional)"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                      />
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
                    <button
                      type="button"
                      onClick={() => setShowMediaAdvanced((v) => !v)}
                      className="text-xs text-brand-accent hover:underline"
                    >
                      {showMediaAdvanced ? "Hide" : "Edit media"}
                    </button>
                  </div>
                  {showMediaAdvanced && (
                    <div className="grid gap-2">
                      <input
                        value={mediaBase}
                        onChange={(e) => setMediaBase(e.target.value)}
                        placeholder="Media base — /avatar/packs/name or leave blank for fallback pack"
                        className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-sm text-brand-text"
                      />
                      <div className="grid gap-1 sm:grid-cols-2">
                        <input
                          value={clipIdle}
                          onChange={(e) => setClipIdle(e.target.value)}
                          placeholder="idle"
                          className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                        />
                        <input
                          value={clipTeasing}
                          onChange={(e) => setClipTeasing(e.target.value)}
                          placeholder="teasing"
                          className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                        />
                        <input
                          value={clipPlayful}
                          onChange={(e) => setClipPlayful(e.target.value)}
                          placeholder="playful"
                          className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                        />
                        <input
                          value={clipAroused}
                          onChange={(e) => setClipAroused(e.target.value)}
                          placeholder="aroused"
                          className="rounded-lg border border-brand-border bg-brand-panel px-3 py-2 text-xs text-brand-text"
                        />
                      </div>
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

          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-panel">
            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ minHeight: "380px", maxHeight: "min(60vh, 520px)" }}
            >
              {messages.length === 0 && !isTyping && (
                <p className="py-20 text-center text-sm text-brand-muted sm:py-24">
                  {status === "ready"
                    ? "Session live — memory is saved. Come back later and hit Resume last chat."
                    : status === "connecting" || restarting
                      ? "Opening live session…"
                      : savedSession
                        ? `Welcome back — resume “${savedSession.characterName ?? savedSession.characterId}” or start a new session.`
                        : "Pick a character and start a session to begin chatting."}
                </p>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-brand-accent text-white shadow-lg shadow-brand-accent/20"
                        : "border border-brand-border bg-brand-bg text-brand-text"
                    }`}
                  >
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    {msg.streaming && (
                      <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-brand-accent align-middle" />
                    )}
                  </div>
                </div>
              ))}

              {isTyping && <TypingIndicator name={characterName} />}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-brand-border p-4">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    status === "ready"
                      ? "Type your message… (Enter to send)"
                      : "Start a session first"
                  }
                  disabled={status !== "ready" || sending}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!canSend}
                  className="self-end rounded-lg bg-brand-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-muted">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={status} />
          {statusLabel}
        </span>
        {sessionId && <span>Session {sessionId.slice(0, 8)}…</span>}
        {error && <span className="text-red-400">{error}</span>}
      </footer>
    </main>
  );
}