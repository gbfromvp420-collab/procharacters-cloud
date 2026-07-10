"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarPanel } from "@/components/AvatarPanel";
import { AvatarVideo } from "@/components/AvatarVideo";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  createCustomCharacter,
  createSession,
  deleteCustomCharacter,
  listLiveCharacters,
  resumeSession,
} from "@/lib/api";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession,
} from "@/lib/session-storage";
import {
  buildCharacterShareUrl,
  buildResumeShareUrl,
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
  const [savedSession, setSavedSession] = useState<StoredSession | null>(null);
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

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
  }, []);

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

  const connectSession = useCallback(
    async (characterId: CharacterId) => {
      setError(null);
      setStatus("connecting");
      pendingHistoryRef.current = null;

      const session = await createSession(characterId);
      setAvatarState(session.avatarState);
      setLivekit(session.livekit ?? null);
      setWsToken(session.wsToken);
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

  const connectResumedSession = useCallback(
    async (stored: StoredSession) => {
      setError(null);
      setStatus("connecting");

      const session = await resumeSession(stored.sessionId, stored.wsToken);
      const history = (session.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as ChatMessage["role"],
        content: m.content,
      }));
      pendingHistoryRef.current = history;
      setMessages(history);
      setCharacter(session.characterId);
      setAvatarState(session.avatarState);
      setLivekit(session.livekit ?? null);
      setWsToken(session.wsToken);
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

  // Deep-links: ?character=…&autostart=1  or  ?session=…&token=… (private resume)
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;
    if (characters.length === 0) return;

    const query = parseShareQuery(window.location.search);
    if (!query.characterId && !(query.sessionId && query.token)) return;

    deepLinkHandledRef.current = true;

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
    const url = buildCharacterShareUrl(character, { autostart });
    const ok = await copyText(url);
    flashCopy(ok ? (autostart ? "Autostart link copied" : "Character link copied") : "Copy failed");
  };

  const sharePrivateResumeLink = async () => {
    if (!sessionId || !wsToken) {
      setError("Start or resume a session before copying a private resume link");
      return;
    }
    const url = buildResumeShareUrl(sessionId, wsToken, {
      characterId: activeCharacterId ?? character,
    });
    const ok = await copyText(url);
    flashCopy(ok ? "Private resume link copied (keep secret)" : "Copy failed");
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
      });
      const option: LiveCharacterOption = {
        id: created.id,
        displayName: created.displayName,
        defaultVersion: created.defaultVersion,
        kind: "custom",
        avatarBase: created.avatarBase,
        energyLabel: created.energyLabel,
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
      flashCopy("Custom ready — use Share to copy link");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom character");
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
        <p className="mt-1 text-sm text-brand-muted">
          Naughty Syntax — v2.1 Live Chat
          {copyNotice && (
            <span className="ml-2 text-brand-accent">· {copyNotice}</span>
          )}
        </p>
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
                    title="Copy public character link"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => shareCharacterLink(true)}
                    className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent"
                    title="Copy link that auto-starts this character"
                  >
                    Share ▶
                  </button>
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
                    disabled={status !== "ready" || !sessionId || !wsToken}
                    className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 transition hover:border-amber-400 disabled:opacity-50"
                    title="Private multi-device resume — anyone with the link can rejoin this transcript"
                  >
                    Copy private resume
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
                    Video pack
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
                    onClick={handleCreateCustom}
                    disabled={
                      creating || customName.trim().length < 2 || customAppearance.trim().length < 12
                    }
                    className="ml-auto rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim disabled:opacity-50"
                  >
                    {creating ? "Creating…" : "Save & Select"}
                  </button>
                </div>
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