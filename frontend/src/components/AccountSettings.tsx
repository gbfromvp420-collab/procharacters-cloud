"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteAccount,
  deleteAccountSession,
  exportAccountSession,
  exportAllAccountSessions,
  fetchAccountMe,
  importAccountSession,
  importFlashSummary,
  linkEmailToAccount,
  listAccountSessions,
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
import { buildResumeCodeShareUrl, copyText } from "@/lib/share-links";

export function AccountSettings() {
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [sessions, setSessions] = useState<AccountSessionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [magicDevLink, setMagicDevLink] = useState<string | null>(null);

  // Signed-out forms
  const [handle, setHandle] = useState("");
  const [pass, setPass] = useState("");
  const [magicEmail, setMagicEmail] = useState("");

  // Settings forms
  const [linkEmail, setLinkEmail] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const refresh = useCallback(async (token: string) => {
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
  }, []);

  useEffect(() => {
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

  const copyResume = async (code: string) => {
    const url = buildResumeCodeShareUrl(code);
    const ok = await copyText(url);
    flash(ok ? `Copied resume ${code}` : "Copy failed");
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
      const result = await importAccountSession(account.token, document);
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
                Import JSON to restore chats as new sessions (new ids — secrets never reused).
                Account bulk exports restore <strong>all</strong> chats (up to 25).
              </p>
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
                          {s.resumeCode ? ` · ${s.resumeCode}` : ""}
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
                      {s.resumeCode && (
                        <button
                          type="button"
                          onClick={() => void copyResume(s.resumeCode!)}
                          className="text-brand-muted hover:text-brand-accent"
                        >
                          Copy
                        </button>
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
