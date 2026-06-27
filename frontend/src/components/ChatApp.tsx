"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarPanel } from "@/components/AvatarPanel";
import { AvatarVideo } from "@/components/AvatarVideo";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
import { TypingIndicator } from "@/components/TypingIndicator";
import { createSession } from "@/lib/api";
import type {
  AvatarState,
  CharacterId,
  ChatMessage,
  ConnectionStatus,
  LiveKitJoinInfo,
} from "@/lib/types";

const CHARACTER_OPTIONS: { id: CharacterId; label: string }[] = [
  { id: "twink-default", label: "Twink Default (v1.2.0)" },
  { id: "female-default", label: "Female Default (v1.2.0)" },
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

  const handleAvatarSync = useCallback((avatar: AvatarState) => {
    setAvatarState(avatar);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setCharacterName(null);
    setActiveCharacterId(null);
    setMessages([]);
    setAvatarState(null);
    setLivekit(null);
    setSending(false);
    setIsTyping(false);
    streamingIdRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    closeSocket(true);
    clearSessionState();
    setStatus("idle");
    setError(null);
    setRestarting(false);
  }, [clearSessionState, closeSocket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => closeSocket(false);
  }, [closeSocket]);

  const bindWebSocket = useCallback(
    (ws: WebSocket, session: { sessionId: string; characterId: string }) => {
      ws.onopen = () => {
        setSessionId(session.sessionId);
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
          case "session_ready":
            setStatus("ready");
            setCharacterName((data.characterName as string) ?? null);
            if (data.avatarState) {
              setAvatarState(data.avatarState as AvatarState);
            }
            setRestarting(false);
            inputRef.current?.focus();
            break;

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
    [closeSocket],
  );

  const connectSession = useCallback(
    async (characterId: CharacterId) => {
      setError(null);
      setStatus("connecting");

      const session = await createSession(characterId);
      setAvatarState(session.avatarState);
      setLivekit(session.livekit ?? null);
      const ws = new WebSocket(session.wsUrl);
      wsRef.current = ws;
      bindWebSocket(ws, session);
    },
    [bindWebSocket],
  );

  const startSession = async () => {
    clearSessionState();
    try {
      await connectSession(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStatus("error");
      setRestarting(false);
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
        <p className="mt-1 text-sm text-brand-muted">Naughty Syntax — v2 Live Chat</p>
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
          <section className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-brand-panel p-3 sm:gap-3 sm:p-4">
            <label className="text-sm text-brand-muted" htmlFor="character">
              Character
            </label>
            <select
              id="character"
              value={character}
              onChange={(e) => setCharacter(e.target.value as CharacterId)}
              disabled={sessionActive}
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text disabled:opacity-50"
            >
              {CHARACTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            {!sessionActive ? (
              <button
                type="button"
                onClick={startSession}
                className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim"
              >
                Start Session
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startNewSession}
                  disabled={status === "connecting" || restarting}
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-accentDim disabled:opacity-50"
                >
                  {restarting ? "Restarting…" : "New Session"}
                </button>
                <button
                  type="button"
                  onClick={endSession}
                  disabled={status === "connecting" || restarting}
                  className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text transition hover:border-brand-accent disabled:opacity-50"
                >
                  End
                </button>
              </>
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
                    ? "Session live — say hello and watch avatar state update with each reply."
                    : status === "connecting" || restarting
                      ? "Opening live session…"
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
        <a
          href="/livecam"
          className="ml-auto text-pink-500 hover:text-pink-400 font-medium transition-colors"
        >
          🎥 Live Cam →
        </a>
      </footer>
    </main>
  );
}