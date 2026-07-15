import { randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import type { AccountRecord } from "./account-store.js";

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
function parseSaltHash(v: string): { salt: string; hash: string } | null {
  const i = v.indexOf("$");
  if (i <= 0) return null;
  return { salt: v.slice(0, i), hash: v.slice(i + 1) };
}
function asAccountRecord(user: {
  id: string; email: string | null; createdAt: Date; credentials: { handle: string; passphraseHash: string }[];
}): AccountRecord {
  const cred = user.credentials[0];
  const parsed = cred ? parseSaltHash(cred.passphraseHash) : null;
  return {
    id: user.id,
    handle: cred?.handle ?? `user_${user.id.slice(0,8)}`,
    email: user.email ?? undefined,
    createdAt: user.createdAt.toISOString(),
    passphraseHash: parsed?.hash,
    salt: parsed?.salt,
  };
}

export async function prismaCreateAccount(handleRaw: string, passphrase: string, hashPassphrase: (p:string,s:string)=>string) {
  const handle = normalizeHandle(handleRaw);
  const existing = await prisma.authCredential.findUnique({ where: { handle } });
  if (existing) throw new Error("CONFLICT_HANDLE");

  const salt = randomBytes(16).toString("hex");
  const hash = hashPassphrase(passphrase, salt);

  const user = await prisma.userAccount.create({
    data: { credentials: { create: { handle, passphraseHash: `${salt}$${hash}` } } },
    include: { credentials: true },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
  await prisma.authToken.create({ data: { accountId: user.id, token, expiresAt } });

  return { id: user.id, handle, token, expiresAt: expiresAt.toISOString() };
}

export async function prismaLoginAccount(handleRaw: string, passphrase: string, hashPassphrase: (p:string,s:string)=>string, safeEqualHex:(a:string,b:string)=>boolean) {
  const handle = normalizeHandle(handleRaw);
  const cred = await prisma.authCredential.findUnique({ where: { handle }, include: { account: true } });
  if (!cred) throw new Error("AUTH_INVALID");
  const parsed = parseSaltHash(cred.passphraseHash);
  if (!parsed) throw new Error("AUTH_INVALID");
  const attempt = hashPassphrase(passphrase, parsed.salt);
  if (!safeEqualHex(attempt, parsed.hash)) throw new Error("AUTH_INVALID");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30*24*60*60*1000);
  await prisma.authToken.create({ data: { accountId: cred.accountId, token, expiresAt } });

  return { id: cred.accountId, handle, email: cred.account.email ? normalizeEmail(cred.account.email) : undefined, token, expiresAt: expiresAt.toISOString() };
}

export async function prismaResolveAccountToken(token: string): Promise<AccountRecord | null> {
  const rec = await prisma.authToken.findUnique({
    where: { token: token.trim() },
    include: { account: { include: { credentials: true } } },
  });
  if (!rec || rec.revokedAt || rec.expiresAt.getTime() < Date.now()) return null;
  return asAccountRecord(rec.account);
}

export async function prismaLogoutAccountToken(token: string): Promise<void> {
  await prisma.authToken.updateMany({
    where: { token: token.trim(), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
