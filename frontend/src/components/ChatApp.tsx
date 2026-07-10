"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarPanel } from "@/components/AvatarPanel";
import { AvatarVideo } from "@/components/AvatarVideo";
import { ClipPreview } from "@/components/ClipPreview";
import { LiveKitAvatarSync } from "@/components/LiveKitAvatarSync";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  claimSession,
  createCustomCharacter,
  createSession,
  deleteCustomCharacter,
  exportLiveSession,
  fetchLiveSessionMarkdown,
  importFlashSummary,
  importSessionDocument,
  listAccountSessions,
  listLiveCharacters,
  fetchAccountMe,
  linkEmailToAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestMagicLink,
  resumeAccountSession,
  resumeByCode,
  resumeSession,
  updateCustomCharacter,
  uploadCharacterClip,
  uploadCharacterClipsBatch,
  verifyMagicLink,
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
  MediaClipKey,
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
  const [accountEmail, setAccountEmail] = useState("");
  const [magicDevLink, setMagicDevLink] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSessions, setAccountSessions] = useState<AccountSessionSummary[]>([]);
  const [accountEmailLinked, setAccountEmailLinked] = useState<string | null>(null);
  const [resumeCodeInput, setResumeCodeInput] = useState("");
  /** Hide avatar video/panel for more transcript space. */
  const [avatarCollapsed, setAvatarCollapsed] = useState(false);

  const handleAvatarSync = useCallback((avatar: AvatarState) => {
    setAvatarState(avatar);
  }, []);

  const setAvatarCollapsedPersist = useCallback((next: boolean) => {
    setAvatarCollapsed(next);
    try {
      window.localStorage.setItem("pc_avatar_collapsed", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("pc_avatar_collapsed");
      if (raw === "1") setAvatarCollapsed(true);
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
      const [sessions, me] = await Promise.all([
        listAccountSessions(token),
        fetchAccountMe(token).catch(() => null),
      ]);
      setAccountSessions(sessions);
      setAccountEmailLinked(me?.email ?? null);
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

  const importChatFromFile = async (file: File | null) => {
    if (!file) return;
    clearSessionState();
    setError(null);
    setStatus("connecting");
    try {
      const text = await file.text();
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }
      // Auto-remap missing customs onto built-ins so bulk restore still works in chat
      const session = await importSessionDocument(document, {
        accountToken: account?.token,
        importAll: true,
        fallbackCharacterId: "twink-default",
      });
      await openLiveSession(session);
      const remapped =
        !!session.imported.remappedFrom ||
        !!session.bulk?.results.some((r) => r.ok && r.remappedFrom);
      flashCopy(
        `${importFlashSummary(session)}${session.imported.truncated ? " (trimmed)" : ""}${
          remapped ? " · remapped missing customs" : ""
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

  const copyChatMarkdown = async () => {
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
        setError("Nothing to copy yet — start chatting first");
        return;
      }
      const ok = await copyText(markdown);
      flashCopy(ok ? "Transcript copied (Markdown)" : "Copy failed");
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
          const ok = await copyText(markdown);
          flashCopy(ok ? "Transcript copied (local Markdown)" : "Copy failed");
          return;
        } catch {
          /* fall through */
        }
      }
      setError(err instanceof Error ? err.message : "Copy transcript failed");
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
        if (claimed.resumeCode) setResumeCode(claimed.resumeCode);
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
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(225,29,143,0.08),transparent_40%)]" />

      {/* Sticky glass top chrome */}
      <header className="glass-bar sticky top-0 z-30 pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent">Naughty Syntax</p>
            <h1 className="truncate bg-gradient-to-r from-brand-text to-brand-accent bg-clip-text text-base font-semibold tracking-tight text-transparent sm:text-xl">
              Live chat
            </h1>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-brand-border bg-brand-panel/80 px-2.5 py-1 text-[11px] text-brand-muted sm:inline-flex">
            <StatusDot status={status} />
            {statusLabel}
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

        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 pb-3 lg:gap-4 ${
            avatarCollapsed ? "lg:flex-col" : "lg:flex-row"
          }`}
        >
          {/* LiveKit stays mounted even when collapsed so avatar state keeps syncing */}
          <div className="sr-only" aria-hidden>
            <LiveKitAvatarSync livekit={livekit} onAvatarSync={handleAvatarSync} />
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
                  {characterName ?? "Avatar hidden"}
                </p>
                <p className="truncate text-[11px] text-brand-muted">
                  {avatarState
                    ? `${avatarState.emotion.replace(/_/g, " ")} · ${Math.round((avatarState.arousalLevel ?? 0) * 100)}%`
                    : "Video collapsed for more chat space"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarCollapsedPersist(false)}
                className="btn-ghost min-h-0 shrink-0 px-3 py-1.5 text-xs"
                title="Show avatar video and status"
              >
                Show avatar
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
                  <AvatarVideo avatar={avatarState} characterName={characterName} compact />
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
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
                {characters.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.kind === "custom" ? "✦ " : ""}
                    {opt.displayName}
                    {opt.defaultVersion ? ` (${opt.defaultVersion})` : ""}
                  </option>
                ))}
              </select>
              </div>

              <div className="scroll-strip -mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5">
              {!sessionActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    className="btn-primary min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                  >
                    Start
                  </button>
                  {savedSession && (
                    <button
                      type="button"
                      onClick={() => void resumeLastSession()}
                      className="btn-ghost min-h-0 shrink-0 border-brand-accent/50 bg-brand-accent/10 px-3 py-2 text-xs sm:text-sm"
                      title={`Resume ${savedSession.characterName ?? savedSession.characterId}`}
                    >
                      Resume last
                    </button>
                  )}
                  <label
                    className="btn-ghost min-h-0 shrink-0 cursor-pointer px-3 py-2 text-xs sm:text-sm"
                    title="Restore a previously exported chat JSON"
                  >
                    Import
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
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
                    onClick={() => shareCharacterLink(false)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                    title="Copy pretty character card link"
                  >
                    Share card
                  </button>
                  <button
                    type="button"
                    onClick={() => shareCharacterLink(true)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs sm:text-sm"
                    title="Copy link that auto-starts this character"
                  >
                    Share ▶
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
                    onClick={() => shareCharacterLink(true)}
                    disabled={status === "connecting" || restarting}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title="Copy public character autostart link"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={sharePrivateResumeLink}
                    disabled={status !== "ready" || !resumeCode}
                    className="btn-ghost min-h-0 shrink-0 border-amber-500/40 px-3 py-2 text-xs text-amber-200 disabled:opacity-50 sm:text-sm"
                    title="Copy ?resume=CODE link — short code, no raw ws token"
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
                    onClick={() => void copyChatMarkdown()}
                    disabled={messages.length === 0 && !(sessionId && wsToken)}
                    className="btn-ghost min-h-0 shrink-0 px-3 py-2 text-xs disabled:opacity-50 sm:text-sm"
                    title="Copy Markdown transcript to clipboard"
                  >
                    Copy MD
                  </button>
                </>
              )}
              </div>
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
            className={`flex flex-1 flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-panel/95 shadow-card backdrop-blur-sm ${
              avatarCollapsed
                ? "min-h-[min(70dvh,560px)] sm:min-h-[480px]"
                : "min-h-[min(52dvh,420px)] sm:min-h-[380px]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-brand-border/60 px-3 py-1.5 sm:px-4">
              <p className="text-[11px] text-brand-muted">
                {messages.length > 0 ? `${messages.length} messages` : "Transcript"}
                {avatarCollapsed ? " · avatar hidden" : ""}
              </p>
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
            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
              {messages.length === 0 && !isTyping && (
                <p className="px-2 py-12 text-center text-sm text-brand-muted sm:py-20">
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
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[80%] sm:px-4 ${
                      msg.role === "user"
                        ? "bg-brand-accent text-white shadow-glow-sm"
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

            {/* Composer — sticky on mobile so keyboard UX stays usable */}
            <div className="sticky bottom-0 border-t border-brand-border/80 bg-brand-panel/95 p-2.5 backdrop-blur-md sm:p-4">
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
                  }}
                  placeholder={
                    status === "ready"
                      ? "Message… (Enter to send)"
                      : "Start a session first"
                  }
                  disabled={status !== "ready" || sending}
                  rows={avatarCollapsed ? 3 : 2}
                  enterKeyHint="send"
                  className="field min-h-[2.75rem] flex-1 resize-none py-2.5 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!canSend}
                  className="btn-primary min-h-[2.75rem] shrink-0 px-4 disabled:opacity-50 sm:px-5"
                >
                  Send
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
    </main>
  );
}