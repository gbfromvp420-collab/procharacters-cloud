import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { repoPath } from "../paths.js";

export interface AccountRecord {
  id: string;
  handle: string;
  /** Optional — magic-link accounts may have no passphrase. */
  passphraseHash?: string;
  salt?: string;
  email?: string;
  createdAt: string;
}

export interface AccountTokenRecord {
  tokenHash: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ResumeCodeRecord {
  code: string;
  sessionId: string;
  accountId?: string;
  createdAt: string;
}

export interface MagicLinkRecord {
  tokenHash: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  /** If set, verifying attaches this email to the existing account (link flow). */
  linkAccountId?: string;
}

interface AccountFile {
  version: 1;
  accounts: AccountRecord[];
  tokens: AccountTokenRecord[];
  resumeCodes: ResumeCodeRecord[];
  magicLinks?: MagicLinkRecord[];
}

const accounts = new Map<string, AccountRecord>();
const handleIndex = new Map<string, string>();
const emailIndex = new Map<string, string>();
const tokens = new Map<string, AccountTokenRecord>();
const resumeCodes = new Map<string, ResumeCodeRecord>();
const magicLinks = new Map<string, MagicLinkRecord>();

let persistPath: string | null = null;
let loaded = false;

function resolvePath(): string {
  if (process.env.ACCOUNTS_PATH?.trim()) return process.env.ACCOUNTS_PATH.trim();
  if (process.env.CUSTOM_CHARACTERS_PATH?.startsWith("/data")) {
    return "/data/accounts.json";
  }
  return repoPath("data", "accounts.json");
}

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function hashPassphrase(passphrase: string, salt: string): string {
  return scryptSync(passphrase, salt, 64).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function persist(): Promise<void> {
  if (!persistPath) return;
  const payload: AccountFile = {
    version: 1,
    accounts: [...accounts.values()],
    tokens: [...tokens.values()],
    resumeCodes: [...resumeCodes.values()],
    magicLinks: [...magicLinks.values()],
  };
  await mkdir(dirname(persistPath), { recursive: true });
  await writeFile(persistPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function initAccountStore(path?: string): Promise<{ path: string; accounts: number }> {
  const resolved = path?.trim() || resolvePath();
  persistPath = resolved;
  accounts.clear();
  handleIndex.clear();
  emailIndex.clear();
  tokens.clear();
  resumeCodes.clear();
  magicLinks.clear();

  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as AccountFile;
    for (const account of parsed.accounts ?? []) {
      accounts.set(account.id, account);
      handleIndex.set(account.handle, account.id);
      if (account.email) emailIndex.set(normalizeEmail(account.email), account.id);
    }
    const now = Date.now();
    for (const token of parsed.tokens ?? []) {
      if (new Date(token.expiresAt).getTime() > now) {
        tokens.set(token.tokenHash, token);
      }
    }
    for (const code of parsed.resumeCodes ?? []) {
      resumeCodes.set(code.code.toUpperCase(), code);
    }
    for (const magic of parsed.magicLinks ?? []) {
      if (!magic.consumedAt && new Date(magic.expiresAt).getTime() > now) {
        magicLinks.set(magic.tokenHash, magic);
      }
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.error("[accounts] failed to load store:", error);
    }
  }

  loaded = true;
  return { path: resolved, accounts: accounts.size };
}

async function ensureLoaded(): Promise<void> {
  if (!loaded) await initAccountStore();
}

export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: "CONFLICT" | "AUTH" | "NOT_FOUND" | "VALIDATION" = "VALIDATION",
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export async function createAccount(handleRaw: string, passphrase: string): Promise<{
  id: string;
  handle: string;
  email?: string;
  token: string;
  expiresAt: string;
}> {
  await ensureLoaded();
  const handle = normalizeHandle(handleRaw);
  if (handle.length < 3) {
    throw new AccountError("Handle must be at least 3 characters (a-z, 0-9, _ -)", "VALIDATION");
  }
  if (!passphrase || passphrase.length < 6) {
    throw new AccountError("Passphrase must be at least 6 characters", "VALIDATION");
  }
  if (handleIndex.has(handle)) {
    throw new AccountError("Handle already taken", "CONFLICT");
  }

  const id = randomBytes(16).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const passphraseHash = hashPassphrase(passphrase, salt);
  const account: AccountRecord = {
    id,
    handle,
    passphraseHash,
    salt,
    createdAt: new Date().toISOString(),
  };
  accounts.set(id, account);
  handleIndex.set(handle, id);

  const issued = await issueToken(id);
  await persist();
  return { id, handle, ...issued };
}

export async function loginAccount(handleRaw: string, passphrase: string): Promise<{
  id: string;
  handle: string;
  email?: string;
  token: string;
  expiresAt: string;
}> {
  await ensureLoaded();
  const handle = normalizeHandle(handleRaw);
  const accountId = handleIndex.get(handle);
  if (!accountId) {
    throw new AccountError("Invalid handle or passphrase", "AUTH");
  }
  const account = accounts.get(accountId)!;
  if (!account.passphraseHash || !account.salt) {
    throw new AccountError("This account uses email magic link sign-in", "AUTH");
  }
  const attempt = hashPassphrase(passphrase, account.salt);
  if (!safeEqualHex(attempt, account.passphraseHash)) {
    throw new AccountError("Invalid handle or passphrase", "AUTH");
  }
  const issued = await issueToken(account.id);
  await persist();
  return { id: account.id, handle: account.handle, email: account.email, ...issued };
}

function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  let base = normalizeHandle(local);
  if (base.length < 3) base = `user${base}`.slice(0, 32);
  let candidate = base;
  let i = 0;
  while (handleIndex.has(candidate)) {
    i += 1;
    candidate = `${base.slice(0, 24)}${i}`;
  }
  return candidate;
}

async function getOrCreateAccountByEmail(emailRaw: string): Promise<AccountRecord> {
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    throw new AccountError("Enter a valid email address", "VALIDATION");
  }

  const existingId = emailIndex.get(email);
  if (existingId) {
    return accounts.get(existingId)!;
  }

  const id = randomBytes(16).toString("hex");
  const handle = handleFromEmail(email);
  const account: AccountRecord = {
    id,
    handle,
    email,
    createdAt: new Date().toISOString(),
  };
  accounts.set(id, account);
  handleIndex.set(handle, id);
  emailIndex.set(email, id);
  return account;
}

/**
 * Create a one-time magic login token for an email (creates account if needed).
 * Returns the raw token for building the verify URL / sending email.
 */
export async function requestMagicLink(
  emailRaw: string,
  options?: { linkAccountId?: string },
): Promise<{
  email: string;
  token: string;
  expiresAt: string;
  accountId: string;
  handle: string;
  isNewAccount: boolean;
  linking: boolean;
}> {
  await ensureLoaded();
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    throw new AccountError("Enter a valid email address", "VALIDATION");
  }

  const linkAccountId = options?.linkAccountId;
  if (linkAccountId) {
    const target = accounts.get(linkAccountId);
    if (!target) {
      throw new AccountError("Account not found", "NOT_FOUND");
    }
    const ownerOfEmail = emailIndex.get(email);
    if (ownerOfEmail && ownerOfEmail !== linkAccountId) {
      throw new AccountError("That email is already linked to another account", "CONFLICT");
    }
    if (target.email && normalizeEmail(target.email) === email) {
      throw new AccountError("This account already uses that email", "VALIDATION");
    }
  }

  const existed = emailIndex.has(email);
  // Login flow may create; link flow only verifies existing target account
  const account = linkAccountId
    ? accounts.get(linkAccountId)!
    : await getOrCreateAccountByEmail(email);

  // Invalidate previous unconsumed magic links for this email
  for (const [hash, record] of magicLinks) {
    if (record.email === email) magicLinks.delete(hash);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  magicLinks.set(tokenHash, {
    tokenHash,
    email,
    createdAt: new Date().toISOString(),
    expiresAt,
    ...(linkAccountId ? { linkAccountId } : {}),
  });
  await persist();

  return {
    email,
    token,
    expiresAt,
    accountId: account.id,
    handle: account.handle,
    isNewAccount: !linkAccountId && !existed,
    linking: !!linkAccountId,
  };
}

export async function verifyMagicLink(tokenRaw: string): Promise<{
  id: string;
  handle: string;
  email?: string;
  token: string;
  expiresAt: string;
  linked?: boolean;
}> {
  await ensureLoaded();
  const token = tokenRaw.trim();
  if (!token) {
    throw new AccountError("Missing magic link token", "VALIDATION");
  }
  const tokenHash = hashToken(token);
  const magic = magicLinks.get(tokenHash);
  if (!magic || magic.consumedAt) {
    throw new AccountError("Magic link is invalid or already used", "AUTH");
  }
  if (new Date(magic.expiresAt).getTime() < Date.now()) {
    magicLinks.delete(tokenHash);
    await persist();
    throw new AccountError("Magic link expired — request a new one", "AUTH");
  }

  magic.consumedAt = new Date().toISOString();
  magicLinks.delete(tokenHash);

  let account: AccountRecord;
  let linked = false;

  if (magic.linkAccountId) {
    account = accounts.get(magic.linkAccountId)!;
    if (!account) {
      throw new AccountError("Account not found for email link", "NOT_FOUND");
    }
    const ownerOfEmail = emailIndex.get(magic.email);
    if (ownerOfEmail && ownerOfEmail !== account.id) {
      throw new AccountError("That email is already linked to another account", "CONFLICT");
    }
    // Detach email from any stale index
    if (account.email) {
      emailIndex.delete(normalizeEmail(account.email));
    }
    account = { ...account, email: magic.email };
    accounts.set(account.id, account);
    emailIndex.set(magic.email, account.id);
    linked = true;
  } else {
    account = await getOrCreateAccountByEmail(magic.email);
  }

  const issued = await issueToken(account.id);
  await persist();
  return {
    id: account.id,
    handle: account.handle,
    email: account.email,
    linked,
    ...issued,
  };
}

async function issueToken(accountId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  tokens.set(tokenHash, {
    tokenHash,
    accountId,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveAccountToken(token: string | undefined | null): Promise<AccountRecord | null> {
  if (!token?.trim()) return null;
  await ensureLoaded();
  const record = tokens.get(hashToken(token.trim()));
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    tokens.delete(record.tokenHash);
    void persist();
    return null;
  }
  return accounts.get(record.accountId) ?? null;
}

export async function logoutAccountToken(token: string): Promise<void> {
  await ensureLoaded();
  tokens.delete(hashToken(token.trim()));
  await persist();
}

export function getAccount(accountId: string): AccountRecord | null {
  return accounts.get(accountId) ?? null;
}

const RESUME_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateResumeCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += RESUME_ALPHABET[randomBytes(1)[0]! % RESUME_ALPHABET.length];
  }
  return code;
}

export async function registerResumeCode(
  sessionId: string,
  accountId?: string,
  preferred?: string,
): Promise<string> {
  await ensureLoaded();
  // Drop previous codes for this session
  for (const [key, value] of resumeCodes) {
    if (value.sessionId === sessionId) resumeCodes.delete(key);
  }

  let code = preferred?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  if (code.length < 6) {
    do {
      code = generateResumeCode();
    } while (resumeCodes.has(code));
  } else if (resumeCodes.has(code) && resumeCodes.get(code)!.sessionId !== sessionId) {
    throw new AccountError("Resume code already in use", "CONFLICT");
  }

  resumeCodes.set(code, {
    code,
    sessionId,
    accountId,
    createdAt: new Date().toISOString(),
  });
  await persist();
  return code;
}

export async function resolveResumeCode(codeRaw: string): Promise<ResumeCodeRecord | null> {
  await ensureLoaded();
  const code = codeRaw.trim().toUpperCase();
  return resumeCodes.get(code) ?? null;
}

export async function listResumeCodesForAccount(accountId: string): Promise<ResumeCodeRecord[]> {
  await ensureLoaded();
  return [...resumeCodes.values()].filter((c) => c.accountId === accountId);
}

export async function bindResumeCodeAccount(sessionId: string, accountId: string): Promise<void> {
  await ensureLoaded();
  for (const [key, value] of resumeCodes) {
    if (value.sessionId === sessionId) {
      resumeCodes.set(key, { ...value, accountId });
    }
  }
  await persist();
}
