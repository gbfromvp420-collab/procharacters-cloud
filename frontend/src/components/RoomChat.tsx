"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSession } from "@/lib/api";
import { TypingIndicator } from "@/components/TypingIndicator";
import type { AvatarState, ChatMessage, ConnectionStatus } from "@/lib/types";

interface RoomChatProps {
  roomId: string;
  characterId: string;
  /** Called when the character's avatar state is updated by a chat reply. */
  onAvatarUpdate?: (avatar: AvatarState) => void;
}

/**
 * In-room real-time chat panel for livecam rooms.
 *
 * Creates a session tied to the room's character and opens a WebSocket
 * for streaming text chat with the AI character during the live show.
 */
export function RoomChat({ roomId, characterId, onAvatarUpdate }: RoomChatProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [characterName, setCharacterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Connect to WebSocket on mount
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("connecting");
      setError(null);

      try {
        const session = await createSession(characterId as "twink-default" | "female-default");
        if (cancelled) return;

        const ws = new WebSocket(session.wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
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
                onAvatarUpdate?.(data.avatarState as AvatarState);
              }
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
                onAvatarUpdate?.(avatarIntent);
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
              onAvatarUpdate?.(data.avatarState as AvatarState);
              break;

            case "session_ended":
              setStatus("ended");
              break;

            case "error":
              setError((data.message as string) ?? "Unknown error");
              setSending(false);
              setIsTyping(false);
              break;
          }
        };

        ws.onerror = () => {
          setError("Chat connection failed");
          setStatus("error");
        };

        ws.onclose = () => {
          wsRef.current = null;
          setSending(false);
          setIsTyping(false);
          setStatus((current) =>
            current === "ready" || current === "connecting" ? "ended" : current,
          );
        };
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to connect chat");
          setStatus("error");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "end_session" }));
        }
        ws.close();
        wsRef.current = null;
      }
    };
  }, [roomId, characterId, onAvatarUpdate]);

  const sendMessage = useCallback(() => {
    const ws = wsRef.current;
    const text = input.trim();
    if (!ws || ws.readyState !== WebSocket.OPEN || !text || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setIsTyping(true);

    ws.send(JSON.stringify({ type: "user_message", content: text }));
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSend = status === "ready" && !sending && input.trim().length > 0;

  return (
    <div className="flex flex-col rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">💬 Chat</span>
          {characterName && (
            <span className="text-xs text-gray-400">with {characterName}</span>
          )}
        </div>
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status === "ready"
              ? "bg-emerald-400"
              : status === "connecting"
                ? "bg-amber-400 animate-pulse"
                : status === "error"
                  ? "bg-red-400"
                  : "bg-gray-500"
          }`}
        />
      </div>

      {/* Messages area */}
      <div
        className="flex-1 space-y-2 overflow-y-auto p-3"
        style={{ minHeight: "200px", maxHeight: "320px" }}
      >
        {messages.length === 0 && !isTyping && (
          <p className="py-8 text-center text-xs text-gray-500">
            {status === "ready"
              ? "Say something to start chatting…"
              : status === "connecting"
                ? "Connecting to chat…"
                : status === "error"
                  ? error ?? "Connection error"
                  : "Chat offline"}
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-pink-600 text-white"
                  : "bg-gray-800 text-gray-200 border border-gray-700"
              }`}
            >
              <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              {msg.streaming && (
                <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-pink-400 align-middle" />
              )}
            </div>
          </div>
        ))}

        {isTyping && <TypingIndicator name={characterName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && status === "error" && (
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800">
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-800 p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={status === "ready" ? "Type a message…" : "Connecting…"}
            disabled={status !== "ready" || sending}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-pink-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!canSend}
            className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-pink-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
