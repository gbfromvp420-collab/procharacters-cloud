"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteAccount,
  deleteAccountSession,
  exportAccountSession,
  exportAllAccountSessions,
  fetchAccountMe,
  fetchAccountSessionMarkdown,
  fetchAllAccountSessionsMarkdown,
  importAccountSession,
  importFlashSummary,
  linkEmailToAccount,
  listAccountSessions,
  listLiveCharacters,
  previewImportDocument,
  emailAccountResumeLinks,
  refreshAccountSessionResume,
  refreshAllAccountResumes,
  type ImportPreview,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestMagicLink,
  resumeAccountSession,
  resumeByCode,
  setAccountPassphrase,
  verifyMagicLink,
  wipeAccountSessions,
  type AccountSessionSummary,
} from "@/lib/api";
import {
  clearStoredAccount,
  loadStoredAccount,
  saveStoredAccount,
  type StoredAccount,
} from "@/lib/account-storage";
import { ImportPreviewPanel } from "@/components/ImportPreviewPanel";
import {
  collectExportCharacters,
  partitionCharacters,
  suggestFallbackId,
  type ExportCharacterRef,
} from "@/lib/import-characters";
import {
  buildResumeCodeShareUrl,
  canNativeShare,
  shareOrCopyText,
  shareOrCopyUrl,
  shareResultLabel,
  shareUrlResultLabel,
} from "@/lib/share-links";
import type { LiveCharacterOption } from "@/lib/types";
import {
  disableWebPush,
  enableWebPush,
  getLocalPushSubscription,
  isPushSupported,
} from "@/lib/web-push-client";

export function AccountSettings() {
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [sessions, setSessions] = useState<AccountSessionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [magicDevLink, setMagicDevLink] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // Signed-out forms
  const [handle, setHandle] = useState("");
  const [pass, setPass] = useState("");
  const [magicEmail, setMagicEmail] = useState("");

  // Settings forms
  const [linkEmail, setLinkEmail] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [resumeCode, setResumeCode] = useState("");

  // Import preview + remap draft
  const [importDoc, setImportDoc] = useState<unknown | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMissing, setImportMissing] = useState<ExportCharacterRef[]>([]);
  const [characterMapDraft, setCharacterMapDraft] = useState<Record<string, string>>({});
  const [liveCharacters, setLiveCharacters] = useState<LiveCharacterOption[]>([]);
  const [fallbackId, setFallbackId] = useState("twink-default");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  /** Banner for codes expiring soon (within EXPIRY_WARN_DAYS). */
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);

  const EXPIRY_WARN_DAYS = 3;

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const checkResumeExpiryWarnings = useCallback(
    (list: AccountSessionSummary[], opts?: { notify?: boolean }) => {
      const soon: AccountSessionSummary[] = [];
      const now = Date.now();
      const horizon = EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000;
      for (const s of list) {
        if (!s.resumeCode || !s.resumeExpiresAt) continue;
        const exp = Date.parse(s.resumeExpiresAt);
        if (Number.isNaN(exp)) continue;
        const left = exp - now;
        if (left >= 0 && left <= horizon) soon.push(s);
      }
      if (soon.length === 0) {
        setExpiryWarning(null);
        return;
      }
      const names = soon
        .slice(0, 3)
        .map((s) => s.characterName)
        .join(", ");
      const more = soon.length > 3 ? ` +${soon.length - 3} more` : "";
      setExpiryWarning(
        `${soon.length} resume code(s) expire within ${EXPIRY_WARN_DAYS} days (${names}${more}). Use New code or Refresh all codes.`,
      );

      // Optional browser notification (permission must already be granted, or we request once)
      if (opts?.notify && typeof window !== "undefined" && "Notification" in window) {
        const key = `pc_resume_expiry_notified_${soon.map((s) => s.sessionId).join(",")}`;
        try {
          if (sessionStorage.getItem(key)) return;
        } catch {
          /* ignore */
        }
        const fire = () => {
          try {
            new Notification("Procharacters resume codes expiring", {
              body: `${soon.length} code(s) expire soon: ${names}${more}`,
              tag: "procharacters-resume-expiry",
            });
            try {
              sessionStorage.setItem(key, "1");
            } catch {
              /* ignore */
            }
          } catch {
            /* ignore */
          }
        };
        if (Notification.permission === "granted") fire();
        else if (Notification.permission === "default") {
          void Notification.requestPermission().then((p) => {
            if (p === "granted") fire();
          });
        }
      }
    },
    [],
  );

  const refresh = useCallback(
    async (token: string) => {
      const [me, list] = await Promise.all([
        fetchAccountMe(token),
        listAccountSessions(token).catch(() => [] as AccountSessionSummary[]),
      ]);
      setEmail(me.email ?? null);
      setHasPassphrase(me.hasPassphrase === true);
      setSessions(list);
      setAccount((prev) =>
        prev
          ? { ...prev, handle: me.handle, accountId: me.accountId }
          : prev,
      );
      checkResumeExpiryWarnings(list, { notify: true });
    },
    [checkResumeExpiryWarnings],
  );

  useEffect(() => {
    setPushSupported(isPushSupported());
    void getLocalPushSubscription().then((sub) => setPushEnabled(!!sub));

    const stored = loadStoredAccount();
    setAccount(stored);
    if (stored) {
      void refresh(stored.token).catch((err) => {
        setError(err instanceof Error ? err.message : "Session expired — sign in again");
        clearStoredAccount();
        setAccount(null);
      });
    }

    // Deep-link magic verify when landing on /account?magic=
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const magic = params.get("magic");
      if (magic) {
        void (async () => {
          setBusy(true);
          try {
            const result = await verifyMagicLink(magic);
            const next: StoredAccount = {
              accountId: result.accountId,
              handle: result.handle,
              token: result.token,
              expiresAt: result.expiresAt,
              savedAt: new Date().toISOString(),
            };
            saveStoredAccount(next);
            setAccount(next);
            await refresh(next.token);
            flash(result.linked ? "Email linked" : `Signed in as @${result.handle}`);
            window.history.replaceState({}, "", "/account");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Magic link failed");
          } finally {
            setBusy(false);
          }
        })();
      }
    }
  }, [refresh]);

  const applyAuth = async (result: {
    accountId: string;
    handle: string;
    token: string;
    expiresAt: string;
  }, label: string) => {
    const next: StoredAccount = {
      accountId: result.accountId,
      handle: result.handle,
      token: result.token,
      expiresAt: result.expiresAt,
      savedAt: new Date().toISOString(),
    };
    saveStoredAccount(next);
    setAccount(next);
    setPass("");
    setMagicDevLink(null);
    await refresh(next.token);
    flash(label);
  };

  const onRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await registerAccount(handle.trim(), pass);
      await applyAuth(result, "Account created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await loginAccount(handle.trim(), pass);
      await applyAuth(result, `Signed in as @${result.handle}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onMagic = async () => {
    setBusy(true);
    setError(null);
    setMagicDevLink(null);
    try {
      const result = await requestMagicLink(magicEmail.trim());
      if (result.magicUrl) {
        setMagicDevLink(result.magicUrl);
        flash(result.delivered ? "Email sent" : "Magic link ready below");
      } else {
        flash(result.delivered ? "Check your email" : "Request sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Magic link failed");
    } finally {
      setBusy(false);
    }
  };

  const onLinkEmail = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    setMagicDevLink(null);
    try {
      const result = await linkEmailToAccount(account.token, linkEmail.trim());
      if (result.magicUrl) {
        setMagicDevLink(result.magicUrl);
        flash("Confirm email link ready");
      } else {
        flash(result.delivered ? "Check your email" : "Link request sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link email failed");
    } finally {
      setBusy(false);
    }
  };

  const onPassphrase = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await setAccountPassphrase(
        account.token,
        newPass,
        hasPassphrase ? currentPass : undefined,
      );
      setHasPassphrase(true);
      setCurrentPass("");
      setNewPass("");
      flash(hasPassphrase ? "Passphrase updated" : "Passphrase set");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passphrase update failed");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    if (account) {
      try {
        await logoutAccount(account.token);
      } catch {
        /* ignore */
      }
    }
    clearStoredAccount();
    try {
      const { clearResumeCache } = await import("@/lib/resume-cache");
      clearResumeCache();
    } catch {
      /* ignore */
    }
    setAccount(null);
    setEmail(null);
    setSessions([]);
    setHasPassphrase(false);
    flash("Signed out");
  };

  const onResumeSession = async (sessionId: string) => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const session = await resumeAccountSession(account.token, sessionId);
      // Hand off to chat via resume code when possible
      if (session.resumeCode) {
        window.location.href = `/chat?resume=${encodeURIComponent(session.resumeCode)}`;
        return;
      }
      window.location.href = `/chat?character=${encodeURIComponent(session.characterId)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume session");
      setBusy(false);
    }
  };

  const onOpenCode = async () => {
    const code = resumeCode.trim();
    if (code.length < 6) {
      setError("Enter a valid resume code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resumeByCode(code);
      window.location.href = `/chat?resume=${encodeURIComponent(code)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid resume code");
      setBusy(false);
    }
  };

  const copyResume = async (code: string, characterName?: string) => {
    const url = buildResumeCodeShareUrl(code);
    const result = await shareOrCopyUrl({
      url,
      title: characterName
        ? `Resume chat with ${characterName}`
        : `Resume Procharacters chat`,
      text: characterName
        ? `Continue your chat with ${characterName} (code ${code})`
        : `Continue your chat (code ${code})`,
    });
    const label = shareUrlResultLabel(result, `Resume ${code}`);
    if (label) flash(label);
  };

  const onRefreshAllResumes = async () => {
    if (!account) return;
    if (
      !window.confirm(
        "Mint new resume codes for ALL saved chats? Old shared links will stop working.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await refreshAllAccountResumes(account.token);
      await refresh(account.token);
      flash(`Refreshed ${result.refreshed} resume code(s) — old links invalidated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh codes");
    } finally {
      setBusy(false);
    }
  };

  const onRefreshOneResume = async (sessionId: string, characterName: string) => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const result = await refreshAccountSessionResume(account.token, sessionId);
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === sessionId
            ? {
                ...s,
                resumeCode: result.resumeCode,
                resumeExpiresAt: result.resumeExpiresAt,
              }
            : s,
        ),
      );
      flash(`New code for ${characterName}: ${result.resumeCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh code");
    } finally {
      setBusy(false);
    }
  };

  const formatExpiry = (iso?: string) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return "expired";
    if (days === 0) return "expires today";
    if (days === 1) return "expires tomorrow";
    return `expires in ${days}d`;
  };

  /** Build Markdown document of every resume link (refreshes session list first). */
  const buildResumeLinksMarkdown = async (): Promise<{
    text: string;
    filename: string;
    count: number;
  } | null> => {
    if (!account) return null;
    const withCodes = sessions.filter((s) => s.resumeCode);
    if (withCodes.length === 0) {
      setError("No resume codes on saved chats yet — open or refresh chats first");
      return null;
    }
    let list = withCodes;
    try {
      list = (await listAccountSessions(account.token)).filter((s) => s.resumeCode);
    } catch {
      /* use current state */
    }
    if (list.length === 0) {
      setError("No resume codes available");
      return null;
    }

    const day = new Date().toISOString().slice(0, 10);
    const lines = [
      `# Procharacters resume links`,
      ``,
      `Account: @${account.handle}`,
      `Exported: ${day}`,
      `Chats: ${list.length}`,
      ``,
      `---`,
      ``,
    ];
    for (const s of list) {
      const code = s.resumeCode!;
      const url = buildResumeCodeShareUrl(code, { characterId: s.characterId });
      lines.push(`## ${s.characterName}`);
      lines.push(`- Code: \`${code}\``);
      lines.push(`- Messages: ${s.messageCount}`);
      lines.push(`- Status: ${s.status}`);
      if (s.resumeExpiresAt) {
        lines.push(`- Expires: ${s.resumeExpiresAt}`);
      }
      lines.push(`- Link: ${url}`);
      lines.push(``);
    }
    lines.push(`_Open a link on any device to continue that chat._`);
    lines.push(``);

    return {
      text: lines.join("\n"),
      filename: `procharacters-resume-links-${account.handle}-${day}.md`,
      count: list.length,
    };
  };

  /** Bundle every resume link into one share/copy payload. */
  const onShareAllResumeLinks = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await buildResumeLinksMarkdown();
      if (!doc) return;
      const result = await shareOrCopyText({
        title: `Resume links · @${account.handle}`,
        text: doc.text,
        filename: doc.filename,
      });
      const label = shareResultLabel(result, `${doc.count} resume links`);
      if (label) flash(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export resume links");
    } finally {
      setBusy(false);
    }
  };

  /** Always download resume links as a .md file (desktop-friendly). */
  const onDownloadResumeLinksMd = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await buildResumeLinksMarkdown();
      if (!doc) return;
      const { downloadMarkdown } = await import("@/lib/download-json");
      downloadMarkdown(doc.filename, doc.text);
      flash(`Downloaded ${doc.count} resume link(s) → ${doc.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download resume links");
    } finally {
      setBusy(false);
    }
  };

  /** Single-session resume snippet as .md */
  const onDownloadOneResumeMd = async (s: AccountSessionSummary) => {
    if (!s.resumeCode) {
      setError("No resume code for this chat");
      return;
    }
    const url = buildResumeCodeShareUrl(s.resumeCode, { characterId: s.characterId });
    const day = new Date().toISOString().slice(0, 10);
    const safe = s.characterName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const text = [
      `# Resume: ${s.characterName}`,
      ``,
      `- Code: \`${s.resumeCode}\``,
      `- Character: ${s.characterId}`,
      `- Messages: ${s.messageCount}`,
      `- Status: ${s.status}`,
      s.resumeExpiresAt ? `- Expires: ${s.resumeExpiresAt}` : null,
      `- Link: ${url}`,
      ``,
      `_Open the link on any device to continue this chat._`,
      ``,
    ]
      .filter((l) => l != null)
      .join("\n");
    const filename = `procharacters-resume-${safe || "chat"}-${s.resumeCode}-${day}.md`;
    const { downloadMarkdown } = await import("@/lib/download-json");
    downloadMarkdown(filename, text);
    flash(`Downloaded resume → ${filename}`);
  };

  const onEmailResumeLinks = async () => {
    if (!account) return;
    if (!email) {
      setError("Link an email on this account first (magic link section above)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await emailAccountResumeLinks(account.token);
      if (result.delivered) {
        flash(`Emailed ${result.count} resume link(s) to ${result.email}`);
      } else {
        flash(
          result.devHint ||
            `Email not delivered (${result.provider}) — try Download resumes.md`,
        );
        if (result.mailError) setError(result.mailError);
        else if (!result.delivered && result.count > 0) {
          // Offer download as fallback when mailer is off
          const doc = await buildResumeLinksMarkdown();
          if (doc) {
            const { downloadMarkdown } = await import("@/lib/download-json");
            downloadMarkdown(doc.filename, doc.text);
            flash(`Mailer offline — downloaded ${doc.count} link(s) as ${doc.filename}`);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email resume links");
    } finally {
      setBusy(false);
    }
  };

  const onEnablePush = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enableWebPush(account.token);
      if (!result.ok) {
        setError(result.error || "Could not enable push");
        return;
      }
      setPushEnabled(true);
      flash("Web Push on — you'll get alerts when resume codes expire soon");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable push");
    } finally {
      setBusy(false);
    }
  };

  const onDisablePush = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await disableWebPush(account.token);
      setPushEnabled(false);
      flash("Web Push off for this browser");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable push");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteSession = async (sessionId: string) => {
    if (!account) return;
    if (!window.confirm("Delete this saved chat permanently?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccountSession(account.token, sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      flash("Chat deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const onExportSession = async (sessionId: string, format: "json" | "md" = "json") => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportAccountSession(account.token, sessionId, format);
      if (format === "md") {
        flash(`Markdown → ${result.filename}`);
      } else {
        flash(`Exported ${result.doc?.session.messageCount ?? "?"} msgs → ${result.filename}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const onExportAllSessions = async (format: "json" | "md" = "json") => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const result = await exportAllAccountSessions(account.token, format);
      if (format === "md") {
        flash(`All chats Markdown → ${result.filename}`);
      } else {
        flash(
          `Exported ${result.doc?.sessionCount ?? "?"} chats (${result.doc?.totalMessages ?? "?"} msgs) → ${result.filename}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export all failed");
    } finally {
      setBusy(false);
    }
  };

  const onShareSessionMd = async (sessionId: string, characterName?: string) => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const md = await fetchAccountSessionMarkdown(account.token, sessionId);
      const safe = (characterName ?? "chat")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const day = new Date().toISOString().slice(0, 10);
      const result = await shareOrCopyText({
        title: `Chat with ${characterName ?? "character"}`,
        text: md,
        filename: `procharacters-${safe || "chat"}-${sessionId.slice(0, 8)}-${day}.md`,
      });
      const label = shareResultLabel(result, "Transcript");
      if (label) flash(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const onShareAllMd = async () => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const md = await fetchAllAccountSessionsMarkdown(account.token);
      const day = new Date().toISOString().slice(0, 10);
      const result = await shareOrCopyText({
        title: "Procharacters chat archive",
        text: md,
        filename: `procharacters-all-chats-${day}.md`,
      });
      const label = shareResultLabel(result, "Archive");
      if (label) flash(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  const clearImportDraft = () => {
    setImportDoc(null);
    setImportPreview(null);
    setImportMissing([]);
    setCharacterMapDraft({});
  };

  const loadPreview = async (
    document: unknown,
    options?: { characterMap?: Record<string, string>; fallbackCharacterId?: string },
  ) => {
    if (!account) return null;
    const map =
      options?.characterMap && Object.keys(options.characterMap).length > 0
        ? options.characterMap
        : undefined;
    const preview = await previewImportDocument(document, {
      accountToken: account.token,
      importAll: true,
      characterMap: map,
      fallbackCharacterId: options?.fallbackCharacterId,
    });
    setImportPreview(preview);
    return preview;
  };

  const runImport = async (
    document: unknown,
    options?: { characterMap?: Record<string, string>; fallbackCharacterId?: string },
  ) => {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importAccountSession(account.token, document, {
        importAll: true,
        characterMap: options?.characterMap,
        fallbackCharacterId: options?.fallbackCharacterId,
      });
      clearImportDraft();
      await refresh(account.token);
      const summary = importFlashSummary(result);
      flash(`${summary} · primary ${result.sessionId.slice(0, 8)}…`);
      if (result.bulk?.failed) {
        const fails = result.bulk.results
          .filter((r) => !r.ok)
          .slice(0, 3)
          .map((r) => (!r.ok ? `${r.characterName ?? r.characterId}: ${r.error}` : ""))
          .filter(Boolean);
        if (fails.length) setError(`Some imports failed: ${fails.join(" · ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (file: File | null) => {
    if (!account || !file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        throw new Error("File is not valid JSON");
      }

      let live = liveCharacters;
      if (live.length === 0) {
        live = await listLiveCharacters();
        setLiveCharacters(live);
      }
      const liveIds = new Set(live.map((c) => c.id));
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
      setCharacterMapDraft(draft);
      setFallbackId(fb);

      // Dry-run with suggested remaps so counts are accurate
      const preview = await loadPreview(document, {
        characterMap: Object.keys(draft).length ? draft : undefined,
        fallbackCharacterId: missing.length ? fb : undefined,
      });

      if (missing.length > 0) {
        flash(
          `Preview: ${preview?.willSucceed ?? 0} ready · ${missing.length} character(s) need remap`,
        );
      } else {
        flash(
          `Preview: ${preview?.willSucceed ?? 0} chat(s), ${preview?.totalMessages ?? 0} msgs — confirm to import`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import preview failed");
      clearImportDraft();
    } finally {
      setBusy(false);
    }
  };

  const onRefreshPreview = async () => {
    if (!importDoc) return;
    setBusy(true);
    setError(null);
    try {
      for (const m of importMissing) {
        if (!characterMapDraft[m.id]?.trim()) {
          setError(`Map a live character for “${m.name}”`);
          return;
        }
      }
      const preview = await loadPreview(importDoc, {
        characterMap: Object.keys(characterMapDraft).length ? characterMapDraft : undefined,
        fallbackCharacterId: importMissing.length ? fallbackId : undefined,
      });
      flash(
        `Preview updated: ${preview?.willSucceed ?? 0} will import, ${preview?.willFail ?? 0} blocked`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const onConfirmRemapImport = async () => {
    if (!importDoc) return;
    for (const m of importMissing) {
      if (!characterMapDraft[m.id]?.trim()) {
        setError(`Map a live character for “${m.name}”`);
        return;
      }
    }
    // Re-preview so we refuse if still blocked
    setBusy(true);
    setError(null);
    try {
      const preview = await loadPreview(importDoc, {
        characterMap: Object.keys(characterMapDraft).length ? characterMapDraft : undefined,
        fallbackCharacterId: importMissing.length ? fallbackId : undefined,
      });
      if (!preview || preview.willSucceed === 0) {
        setError("Nothing would import — fix remaps or character map");
        setBusy(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setBusy(false);
      return;
    }
    await runImport(importDoc, {
      characterMap: Object.keys(characterMapDraft).length ? characterMapDraft : undefined,
      fallbackCharacterId: importMissing.length ? fallbackId : undefined,
    });
  };

  const onWipeSessions = async () => {
    if (!account) return;
    if (!window.confirm("Wipe ALL saved chats on this account? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await wipeAccountSessions(account.token);
      setSessions([]);
      flash(`Wiped ${result.deleted} chat(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wipe failed");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!account) return;
    if (deleteConfirm !== "DELETE") {
      setError('Type DELETE in the confirm box to permanently remove your account');
      return;
    }
    if (!window.confirm("Permanently delete your account and all saved chats?")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteAccount(account.token);
      clearStoredAccount();
      setAccount(null);
      setEmail(null);
      setSessions([]);
      setHasPassphrase(false);
      setDeleteConfirm("");
      flash(`Account deleted (${result.sessionsWiped} chats wiped)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh" />
      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs text-brand-muted hover:text-brand-accent">
              ← Gallery
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-brand-text">Account settings</h1>
            <p className="mt-1 text-sm text-brand-muted">
              Profile, email magic link, passphrase, and saved chats.
            </p>
          </div>
          <Link href="/chat" className="btn-primary min-h-0 px-4 py-2 text-sm">
            Live chat
          </Link>
        </header>

        {(error || notice) && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
            }`}
          >
            {error || notice}
          </div>
        )}

        {!account ? (
          <section className="space-y-6 rounded-2xl border border-brand-border bg-brand-panel p-5">
            <div>
              <h2 className="text-sm font-semibold text-brand-text">Email magic link</h2>
              <p className="mt-1 text-xs text-brand-muted">Preferred multi-device sign-in.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                />
                <button
                  type="button"
                  disabled={busy || !magicEmail.includes("@")}
                  onClick={() => void onMagic()}
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Email link"}
                </button>
              </div>
              {magicDevLink && (
                <a
                  href={magicDevLink}
                  className="mt-2 block break-all text-xs text-brand-accent hover:underline"
                >
                  {magicDevLink}
                </a>
              )}
            </div>

            <div className="border-t border-brand-border pt-5">
              <h2 className="text-sm font-semibold text-brand-text">Handle + passphrase</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="Handle"
                  className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                />
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Passphrase (6+)"
                  className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy || handle.trim().length < 3 || pass.length < 6}
                  onClick={() => void onLogin()}
                  className="rounded-lg border border-brand-border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  disabled={busy || handle.trim().length < 3 || pass.length < 6}
                  onClick={() => void onRegister()}
                  className="rounded-lg border border-brand-border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Register
                </button>
              </div>
            </div>

            <div className="border-t border-brand-border pt-5">
              <h2 className="text-sm font-semibold text-brand-text">Open resume code</h2>
              <div className="mt-2 flex gap-2">
                <input
                  value={resumeCode}
                  onChange={(e) => setResumeCode(e.target.value.toUpperCase())}
                  placeholder="AB3K9MPQ"
                  className="flex-1 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 font-mono text-sm text-brand-text"
                />
                <button
                  type="button"
                  onClick={() => void onOpenCode()}
                  className="rounded-lg border border-brand-accent/50 px-4 py-2 text-sm"
                >
                  Open
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="rounded-2xl border border-brand-border bg-brand-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-accent">Profile</p>
                  <h2 className="mt-1 text-2xl font-semibold text-brand-text">@{account.handle}</h2>
                  <p className="mt-1 text-sm text-brand-muted">
                    {email ? (
                      <>
                        Email: <span className="text-brand-text">{email}</span>
                      </>
                    ) : (
                      "No email linked yet"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-brand-muted">
                    Passphrase: {hasPassphrase ? "set" : "not set (magic link only)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="rounded-lg border border-brand-border px-3 py-1.5 text-xs hover:border-brand-accent"
                >
                  Sign out
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-panel p-5">
              <h2 className="text-sm font-semibold text-brand-text">
                {email ? "Change linked email" : "Link email"}
              </h2>
              <p className="mt-1 text-xs text-brand-muted">
                Confirm via magic link so you can sign in on any device with email.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                />
                <button
                  type="button"
                  disabled={busy || !linkEmail.includes("@")}
                  onClick={() => void onLinkEmail()}
                  className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Send confirm link
                </button>
              </div>
              {magicDevLink && (
                <a
                  href={magicDevLink}
                  className="mt-2 block break-all text-xs text-brand-accent hover:underline"
                >
                  {magicDevLink}
                </a>
              )}
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-panel p-5">
              <h2 className="text-sm font-semibold text-brand-text">
                {hasPassphrase ? "Change passphrase" : "Set passphrase"}
              </h2>
              <p className="mt-1 text-xs text-brand-muted">
                Optional backup sign-in if you prefer not to use email every time.
              </p>
              <div className="mt-3 grid gap-2">
                {hasPassphrase && (
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Current passphrase"
                    className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                  />
                )}
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New passphrase (6+)"
                  className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text"
                />
                <button
                  type="button"
                  disabled={
                    busy ||
                    newPass.length < 6 ||
                    (hasPassphrase && currentPass.length < 6)
                  }
                  onClick={() => void onPassphrase()}
                  className="justify-self-start rounded-lg border border-brand-border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Save passphrase
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-panel p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-brand-text">Saved chats</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer text-xs text-brand-text hover:text-brand-accent">
                    <span className={busy ? "opacity-50" : ""}>Import JSON</span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void onImportFile(f);
                      }}
                    />
                  </label>
                  {sessions.length > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onExportAllSessions("json")}
                        className="text-xs text-brand-text hover:text-brand-accent disabled:opacity-50"
                        title="Download all chats as one JSON file"
                      >
                        Export all JSON
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onExportAllSessions("md")}
                        className="text-xs text-brand-text hover:text-brand-accent disabled:opacity-50"
                        title="Download all chats as one Markdown file"
                      >
                        Export all MD
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onShareAllMd()}
                        className="text-xs text-brand-text hover:text-brand-accent disabled:opacity-50"
                        title={
                          canNativeShare()
                            ? "Share all chats as Markdown via system sheet"
                            : "Copy all chats as Markdown to clipboard"
                        }
                      >
                        {canNativeShare() ? "Share all MD" : "Copy all MD"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !sessions.some((s) => s.resumeCode)}
                        onClick={() => void onShareAllResumeLinks()}
                        className="text-xs text-amber-200/90 hover:text-amber-100 disabled:opacity-50"
                        title={
                          canNativeShare()
                            ? "Share all resume links as Markdown"
                            : "Copy all resume links as Markdown"
                        }
                      >
                        {canNativeShare() ? "Share all resumes" : "Copy all resumes"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !sessions.some((s) => s.resumeCode)}
                        onClick={() => void onDownloadResumeLinksMd()}
                        className="text-xs text-amber-200/90 hover:text-amber-100 disabled:opacity-50"
                        title="Download all resume links as a .md file"
                      >
                        Download resumes.md
                      </button>
                      <button
                        type="button"
                        disabled={busy || !sessions.some((s) => s.resumeCode) || !email}
                        onClick={() => void onEmailResumeLinks()}
                        className="text-xs text-amber-200/90 hover:text-amber-100 disabled:opacity-50"
                        title={
                          email
                            ? `Email resume links to ${email}`
                            : "Link an email first to use this"
                        }
                      >
                        Email resumes
                      </button>
                      <button
                        type="button"
                        disabled={busy || sessions.length === 0}
                        onClick={() => void onRefreshAllResumes()}
                        className="text-xs text-brand-text hover:text-brand-accent disabled:opacity-50"
                        title="Mint new resume codes for every chat (invalidates old links)"
                      >
                        Refresh all codes
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onWipeSessions()}
                        className="text-xs text-red-300 hover:underline disabled:opacity-50"
                      >
                        Wipe all
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => account && void refresh(account.token)}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <p className="mb-3 text-[11px] text-brand-muted">
                Import JSON runs a <strong>dry-run preview</strong> first (counts + remaps, no
                writes). Confirm to restore chats as new sessions (up to 25). Missing customs can
                be remapped to a live model.
              </p>

              {expiryWarning && (
                <div
                  className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  role="status"
                >
                  <p className="font-medium">Resume codes expiring soon</p>
                  <p className="mt-1 text-xs text-amber-100/80">{expiryWarning}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRefreshAllResumes()}
                      className="text-xs font-medium text-amber-200 underline hover:text-white disabled:opacity-50"
                    >
                      Refresh all codes now
                    </button>
                    {pushSupported && !pushEnabled && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onEnablePush()}
                        className="text-xs font-medium text-amber-200 underline hover:text-white disabled:opacity-50"
                      >
                        Enable push alerts
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpiryWarning(null)}
                      className="text-xs text-brand-muted hover:text-brand-text"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {pushSupported && (
                <div className="mb-4 rounded-xl border border-brand-border bg-brand-surface/40 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-brand-text">
                        Web Push · resume expiry
                      </p>
                      <p className="mt-0.5 text-[11px] text-brand-muted">
                        {pushEnabled
                          ? "This browser is subscribed. Alerts when codes expire within 3 days."
                          : "Get a system notification when resume codes are about to expire (even if this tab is closed)."}
                      </p>
                    </div>
                    {pushEnabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDisablePush()}
                        className="shrink-0 rounded-lg border border-brand-border px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text disabled:opacity-50"
                      >
                        Disable push
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onEnablePush()}
                        className="shrink-0 rounded-lg bg-brand-accent/20 px-3 py-1.5 text-xs font-medium text-brand-accent hover:bg-brand-accent/30 disabled:opacity-50"
                      >
                        Enable push
                      </button>
                    )}
                  </div>
                </div>
              )}

              {importDoc != null && importPreview ? (
                <div className="mb-4">
                  <ImportPreviewPanel
                    preview={importPreview}
                    missing={importMissing}
                    characterMap={characterMapDraft}
                    onCharacterMapChange={setCharacterMapDraft}
                    fallbackId={fallbackId}
                    onFallbackChange={setFallbackId}
                    liveCharacters={liveCharacters}
                    busy={busy}
                    onRefreshPreview={() => void onRefreshPreview()}
                    onConfirm={() => void onConfirmRemapImport()}
                    onCancel={clearImportDraft}
                  />
                </div>
              ) : null}

              {sessions.length === 0 ? (
                <p className="text-xs text-brand-muted">
                  No chats yet. Start one in live chat while signed in, or import a JSON export.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((s) => (
                    <li
                      key={s.sessionId}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border/70 bg-brand-bg px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-brand-text">{s.characterName}</p>
                        <p className="text-brand-muted">
                          {s.messageCount} msgs · {s.status}
                          {s.resumeCode ? (
                            <>
                              {" · "}
                              <span className="font-mono text-amber-200/90">{s.resumeCode}</span>
                              {s.resumeExpiresAt ? (
                                <span className="text-brand-soft">
                                  {" "}
                                  ({formatExpiry(s.resumeExpiresAt)})
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onExportSession(s.sessionId, "json")}
                        className="text-brand-muted hover:text-brand-accent disabled:opacity-50"
                        title="Download this chat as JSON"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onExportSession(s.sessionId, "md")}
                        className="text-brand-muted hover:text-brand-accent disabled:opacity-50"
                        title="Download this chat as Markdown"
                      >
                        MD
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onShareSessionMd(s.sessionId, s.characterName)}
                        className="text-brand-muted hover:text-brand-accent disabled:opacity-50"
                        title={
                          canNativeShare()
                            ? "Share Markdown via system share sheet"
                            : "Copy Markdown transcript to clipboard"
                        }
                      >
                        {canNativeShare() ? "Share MD" : "Copy MD"}
                      </button>
                      {s.resumeCode && (
                        <>
                          <button
                            type="button"
                            onClick={() => void copyResume(s.resumeCode!, s.characterName)}
                            className="text-brand-muted hover:text-brand-accent"
                          >
                            {canNativeShare() ? "Share code" : "Copy code"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onDownloadOneResumeMd(s)}
                            className="text-brand-muted hover:text-brand-accent disabled:opacity-50"
                            title="Download this resume as a .md snippet"
                          >
                            .md
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onRefreshOneResume(s.sessionId, s.characterName)
                            }
                            className="text-brand-muted hover:text-brand-accent disabled:opacity-50"
                            title="Mint a new resume code (old link stops working)"
                          >
                            New code
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => void onDeleteSession(s.sessionId)}
                        className="text-red-300/80 hover:text-red-200"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => void onResumeSession(s.sessionId)}
                        className="rounded-lg bg-brand-accent px-3 py-1.5 font-medium text-white"
                      >
                        Resume
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <h2 className="text-sm font-semibold text-red-200">Danger zone</h2>
              <p className="mt-1 text-xs text-brand-muted">
                Permanently delete your account, auth tokens, and all saved chats. Type{" "}
                <span className="font-mono text-red-200">DELETE</span> to confirm.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE"
                  className="rounded-lg border border-red-500/30 bg-brand-bg px-3 py-2 font-mono text-sm text-brand-text"
                />
                <button
                  type="button"
                  disabled={busy || deleteConfirm !== "DELETE"}
                  onClick={() => void onDeleteAccount()}
                  className="rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-100 disabled:opacity-40"
                >
                  Delete account forever
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-panel p-5">
              <h2 className="text-sm font-semibold text-brand-text">Open resume code</h2>
              <div className="mt-2 flex gap-2">
                <input
                  value={resumeCode}
                  onChange={(e) => setResumeCode(e.target.value.toUpperCase())}
                  placeholder="AB3K9MPQ"
                  className="flex-1 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 font-mono text-sm text-brand-text"
                />
                <button
                  type="button"
                  onClick={() => void onOpenCode()}
                  className="rounded-lg border border-brand-accent/50 px-4 py-2 text-sm"
                >
                  Open
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
