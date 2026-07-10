import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { repoPath } from "../paths.js";

export interface AccountRecord {
  id: string;
  handle: string;
  passphraseHash: string;
  salt: string;
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

interface AccountFile {
  version: 1;
  accounts: AccountRecord[];
  tokens: AccountTokenRecord[];
  resumeCodes: ResumeCodeRecord[];
}

const accounts = new Map<string, AccountRecord>();
const handleIndex = new Map<string, string>();
const tokens = new Map<string, AccountTokenRecord>();
const resumeCodes = new Map<string, ResumeCodeRecord>();

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

async function persist(): Promise<void> {
  if (!persistPath) return;
  const payload: AccountFile = {
    version: 1,
    accounts: [...accounts.values()],
    tokens: [...tokens.values()],
    resumeCodes: [...resumeCodes.values()],
  };
  await mkdir(dirname(persistPath), { recursive: true });
  await writeFile(persistPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function initAccountStore(path?: string): Promise<{ path: string; accounts: number }> {
  const resolved = path?.trim() || resolvePath();
  persistPath = resolved;
  accounts.clear();
  handleIndex.clear();
  tokens.clear();
  resumeCodes.clear();

  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as AccountFile;
    for (const account of parsed.accounts ?? []) {
      accounts.set(account.id, account);
      handleIndex.set(account.handle, account.id);
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
  const attempt = hashPassphrase(passphrase, account.salt);
  if (!safeEqualHex(attempt, account.passphraseHash)) {
    throw new AccountError("Invalid handle or passphrase", "AUTH");
  }
  const issued = await issueToken(account.id);
  await persist();
  return { id: account.id, handle: account.handle, ...issued };
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
