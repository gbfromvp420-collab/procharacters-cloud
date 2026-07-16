import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../prisma.js";
import type {
  AccountPlan,
  AccountRecord,
  ResumeCodeRecord,
} from "./account-store.js";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_TTL_MS = 15 * 60 * 1000;
const RESUME_TTL_DAYS = Number(process.env.RESUME_CODE_TTL_DAYS ?? 14);
const RESUME_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function resumeExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + RESUME_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += RESUME_ALPHABET[randomBytes(1)[0]! % RESUME_ALPHABET.length];
  }
  return code;
}

function isExpired(record: ResumeCodeRecord, now = Date.now()): boolean {
  if (!record.expiresAt) {
    const created = Date.parse(record.createdAt);
    if (Number.isNaN(created)) return false;
    return created + RESUME_TTL_DAYS * 24 * 60 * 60 * 1000 < now;
  }
  const exp = Date.parse(record.expiresAt);
  if (Number.isNaN(exp)) return false;
  return exp < now;
}

/** In-process cache so sync getAccount() works under prisma provider. */
const accountCache = new Map<string, AccountRecord>();

export function prismaCacheAccount(account: AccountRecord): void {
  accountCache.set(account.id, account);
}

export function prismaGetCachedAccount(accountId: string): AccountRecord | null {
  return accountCache.get(accountId) ?? null;
}

export function prismaDropCachedAccount(accountId: string): void {
  accountCache.delete(accountId);
}

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

/** Match JSON account-store: never persist raw bearer tokens. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function asAccountRecord(user: {
  id: string;
  handle: string;
  email: string | null;
  createdAt: Date;
  plan?: string | null;
  planExpiresAt?: Date | null;
  stripeCustomerId?: string | null;
  lastCheckoutSessionId?: string | null;
  credentials: { handle: string; passphraseHash: string }[];
}): AccountRecord {
  const cred = user.credentials[0];
  const parsed = cred ? parseSaltHash(cred.passphraseHash) : null;
  const plan = (user.plan as AccountPlan | null | undefined) ?? undefined;
  const record: AccountRecord = {
    id: user.id,
    handle: user.handle || cred?.handle || `user_${user.id.slice(0, 8)}`,
    email: user.email ? normalizeEmail(user.email) : undefined,
    createdAt: user.createdAt.toISOString(),
    passphraseHash: parsed?.hash,
    salt: parsed?.salt,
    plan: plan === "day_pass" || plan === "supporter" || plan === "free" ? plan : undefined,
    planExpiresAt: user.planExpiresAt?.toISOString(),
    stripeCustomerId: user.stripeCustomerId ?? undefined,
    lastCheckoutSessionId: user.lastCheckoutSessionId ?? undefined,
  };
  prismaCacheAccount(record);
  return record;
}

async function issuePrismaToken(
  accountId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await prisma.authToken.create({
    data: {
      accountId,
      token: hashToken(token),
      expiresAt,
    },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function loadAccountById(accountId: string): Promise<AccountRecord | null> {
  const user = await prisma.userAccount.findUnique({
    where: { id: accountId },
    include: { credentials: true },
  });
  if (!user) return null;
  return asAccountRecord(user);
}

async function uniqueHandleFromEmail(email: string): Promise<string> {
  const local = email.split("@")[0] ?? "user";
  let base = normalizeHandle(local);
  if (base.length < 3) base = `user${base}`.slice(0, 32);
  let candidate = base;
  let i = 0;
  while (true) {
    const hit = await prisma.userAccount.findUnique({ where: { handle: candidate } });
    if (!hit) return candidate;
    i += 1;
    candidate = `${base.slice(0, 24)}${i}`;
  }
}

export async function prismaCreateAccount(
  handleRaw: string,
  passphrase: string,
  hashPassphrase: (p: string, s: string) => string,
): Promise<{ id: string; handle: string; token: string; expiresAt: string }> {
  const handle = normalizeHandle(handleRaw);
  const existing = await prisma.userAccount.findUnique({ where: { handle } });
  if (existing) throw new Error("CONFLICT_HANDLE");
  const existingCred = await prisma.authCredential.findUnique({ where: { handle } });
  if (existingCred) throw new Error("CONFLICT_HANDLE");

  const salt = randomBytes(16).toString("hex");
  const hash = hashPassphrase(passphrase, salt);

  const user = await prisma.userAccount.create({
    data: {
      handle,
      credentials: {
        create: { handle, passphraseHash: `${salt}$${hash}` },
      },
    },
    include: { credentials: true },
  });
  asAccountRecord(user);

  const issued = await issuePrismaToken(user.id);
  return { id: user.id, handle, ...issued };
}

export async function prismaLoginAccount(
  handleRaw: string,
  passphrase: string,
  hashPassphrase: (p: string, s: string) => string,
  safeEqualHex: (a: string, b: string) => boolean,
): Promise<{
  id: string;
  handle: string;
  email?: string;
  token: string;
  expiresAt: string;
}> {
  const handle = normalizeHandle(handleRaw);
  const cred = await prisma.authCredential.findUnique({
    where: { handle },
    include: { account: { include: { credentials: true } } },
  });
  if (!cred) throw new Error("AUTH_INVALID");

  const parsed = parseSaltHash(cred.passphraseHash);
  if (!parsed) throw new Error("AUTH_INVALID");

  const attempt = hashPassphrase(passphrase, parsed.salt);
  if (!safeEqualHex(attempt, parsed.hash)) throw new Error("AUTH_INVALID");

  asAccountRecord(cred.account);
  const issued = await issuePrismaToken(cred.accountId);
  return {
    id: cred.accountId,
    handle,
    email: cred.account.email ? normalizeEmail(cred.account.email) : undefined,
    ...issued,
  };
}

export async function prismaResolveAccountToken(token: string): Promise<AccountRecord | null> {
  const rec = await prisma.authToken.findUnique({
    where: { token: hashToken(token.trim()) },
    include: { account: { include: { credentials: true } } },
  });
  if (!rec || rec.revokedAt || rec.expiresAt.getTime() < Date.now()) return null;
  return asAccountRecord(rec.account);
}

export async function prismaLogoutAccountToken(token: string): Promise<void> {
  await prisma.authToken.updateMany({
    where: { token: hashToken(token.trim()), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function prismaRequestMagicLink(
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
  const email = normalizeEmail(emailRaw);
  const linkAccountId = options?.linkAccountId;

  if (linkAccountId) {
    const target = await loadAccountById(linkAccountId);
    if (!target) throw new Error("NOT_FOUND");
    const owner = await prisma.userAccount.findUnique({ where: { email } });
    if (owner && owner.id !== linkAccountId) throw new Error("CONFLICT_EMAIL");
    if (target.email && normalizeEmail(target.email) === email) {
      throw new Error("VALIDATION_EMAIL_ALREADY");
    }
  }

  let account: AccountRecord;
  let isNewAccount = false;

  if (linkAccountId) {
    account = (await loadAccountById(linkAccountId))!;
  } else {
    const existing = await prisma.userAccount.findUnique({
      where: { email },
      include: { credentials: true },
    });
    if (existing) {
      account = asAccountRecord(existing);
    } else {
      const handle = await uniqueHandleFromEmail(email);
      const created = await prisma.userAccount.create({
        data: { handle, email },
        include: { credentials: true },
      });
      account = asAccountRecord(created);
      isNewAccount = true;
    }
  }

  // Invalidate previous unconsumed magic links for this email
  await prisma.magicLink.deleteMany({
    where: { email, consumedAt: null },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MS);
  await prisma.magicLink.create({
    data: {
      tokenHash: hashToken(token),
      email,
      expiresAt,
      linkAccountId: linkAccountId ?? null,
    },
  });

  return {
    email,
    token,
    expiresAt: expiresAt.toISOString(),
    accountId: account.id,
    handle: account.handle,
    isNewAccount: !linkAccountId && isNewAccount,
    linking: !!linkAccountId,
  };
}

export async function prismaVerifyMagicLink(tokenRaw: string): Promise<{
  id: string;
  handle: string;
  email?: string;
  token: string;
  expiresAt: string;
  linked?: boolean;
}> {
  const token = tokenRaw.trim();
  if (!token) throw new Error("VALIDATION_MAGIC");

  const magic = await prisma.magicLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!magic || magic.consumedAt) throw new Error("AUTH_MAGIC");
  if (magic.expiresAt.getTime() < Date.now()) {
    await prisma.magicLink.delete({ where: { id: magic.id } }).catch(() => undefined);
    throw new Error("AUTH_MAGIC_EXPIRED");
  }

  await prisma.magicLink.update({
    where: { id: magic.id },
    data: { consumedAt: new Date() },
  });

  let account: AccountRecord;
  let linked = false;

  if (magic.linkAccountId) {
    const target = await loadAccountById(magic.linkAccountId);
    if (!target) throw new Error("NOT_FOUND");
    const owner = await prisma.userAccount.findUnique({ where: { email: magic.email } });
    if (owner && owner.id !== target.id) throw new Error("CONFLICT_EMAIL");

    const updated = await prisma.userAccount.update({
      where: { id: target.id },
      data: { email: magic.email },
      include: { credentials: true },
    });
    account = asAccountRecord(updated);
    linked = true;
  } else {
    const existing = await prisma.userAccount.findUnique({
      where: { email: magic.email },
      include: { credentials: true },
    });
    if (existing) {
      account = asAccountRecord(existing);
    } else {
      const handle = await uniqueHandleFromEmail(magic.email);
      const created = await prisma.userAccount.create({
        data: { handle, email: magic.email },
        include: { credentials: true },
      });
      account = asAccountRecord(created);
    }
  }

  const issued = await issuePrismaToken(account.id);
  return {
    id: account.id,
    handle: account.handle,
    email: account.email,
    linked,
    ...issued,
  };
}

export async function prismaGrantAccountPlan(
  accountId: string,
  plan: "day_pass" | "supporter",
  options?: { stripeCustomerId?: string; checkoutSessionId?: string; days?: number },
): Promise<AccountRecord> {
  const user = await prisma.userAccount.findUnique({
    where: { id: accountId },
    include: { credentials: true },
  });
  if (!user) throw new Error("NOT_FOUND");

  const days =
    options?.days ??
    (plan === "day_pass"
      ? Number(process.env.STRIPE_DAY_PASS_DAYS ?? 1)
      : Number(process.env.STRIPE_SUPPORTER_DAYS ?? 30));

  const now = Date.now();
  let base = now;
  if (user.planExpiresAt) {
    const prev = user.planExpiresAt.getTime();
    if (prev > now) base = prev;
  }

  const planExpiresAt = new Date(base + days * 24 * 60 * 60 * 1000);
  const updated = await prisma.userAccount.update({
    where: { id: accountId },
    data: {
      plan,
      planExpiresAt,
      ...(options?.stripeCustomerId ? { stripeCustomerId: options.stripeCustomerId } : {}),
      ...(options?.checkoutSessionId
        ? { lastCheckoutSessionId: options.checkoutSessionId }
        : {}),
    },
    include: { credentials: true },
  });
  return asAccountRecord(updated);
}

export async function prismaSetAccountPassphrase(
  accountId: string,
  options: { newPassphrase: string; currentPassphrase?: string },
  hashPassphrase: (p: string, s: string) => string,
  safeEqualHex: (a: string, b: string) => boolean,
): Promise<AccountRecord> {
  const user = await prisma.userAccount.findUnique({
    where: { id: accountId },
    include: { credentials: true },
  });
  if (!user) throw new Error("NOT_FOUND");
  if (!options.newPassphrase || options.newPassphrase.length < 6) {
    throw new Error("VALIDATION_PASSPHRASE");
  }

  const existing = user.credentials[0];
  if (existing) {
    const parsed = parseSaltHash(existing.passphraseHash);
    if (parsed) {
      if (!options.currentPassphrase) throw new Error("VALIDATION_CURRENT");
      const attempt = hashPassphrase(options.currentPassphrase, parsed.salt);
      if (!safeEqualHex(attempt, parsed.hash)) throw new Error("AUTH_INVALID");
    }
  }

  const salt = randomBytes(16).toString("hex");
  const passphraseHash = `${salt}$${hashPassphrase(options.newPassphrase, salt)}`;

  if (existing) {
    await prisma.authCredential.update({
      where: { id: existing.id },
      data: { passphraseHash },
    });
  } else {
    await prisma.authCredential.create({
      data: {
        accountId,
        handle: user.handle,
        passphraseHash,
      },
    });
  }

  const refreshed = await loadAccountById(accountId);
  if (!refreshed) throw new Error("NOT_FOUND");
  return refreshed;
}

export async function prismaDeleteAccount(accountId: string): Promise<boolean> {
  const user = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (!user) return false;

  // Drop account ownership from resume codes; keep session mapping
  await prisma.resumeCode.updateMany({
    where: { accountId },
    data: { accountId: null },
  });
  await prisma.magicLink.deleteMany({
    where: {
      OR: [{ linkAccountId: accountId }, ...(user.email ? [{ email: user.email }] : [])],
    },
  });
  await prisma.userAccount.delete({ where: { id: accountId } });
  prismaDropCachedAccount(accountId);
  return true;
}

function asResumeRecord(row: {
  code: string;
  sessionId: string;
  accountId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}): ResumeCodeRecord {
  return {
    code: row.code,
    sessionId: row.sessionId,
    accountId: row.accountId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
  };
}

export async function prismaRegisterResumeCode(
  sessionId: string,
  accountId?: string,
  preferred?: string,
  options?: { forceNew?: boolean; extendOnly?: boolean },
): Promise<string> {
  // Rebind preferred code if still valid
  if (preferred && !options?.forceNew) {
    const existing = await prisma.resumeCode.findUnique({
      where: { code: preferred.toUpperCase() },
    });
    if (existing && existing.sessionId === sessionId) {
      const record = asResumeRecord(existing);
      if (!isExpired(record)) {
        if (options?.extendOnly !== false) {
          const expiresAt = resumeExpiresAt();
          await prisma.resumeCode.update({
            where: { code: existing.code },
            data: {
              accountId: accountId ?? existing.accountId,
              expiresAt,
            },
          });
          return existing.code;
        }
        return existing.code;
      }
    }
  }

  // Drop previous codes for this session
  await prisma.resumeCode.deleteMany({ where: { sessionId } });

  let code = preferred?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  if (options?.forceNew || code.length < 6) {
    do {
      code = generateCode();
    } while (await prisma.resumeCode.findUnique({ where: { code } }));
  } else {
    const clash = await prisma.resumeCode.findUnique({ where: { code } });
    if (clash && clash.sessionId !== sessionId) throw new Error("CONFLICT_RESUME");
  }

  const now = new Date();
  const expiresAt = resumeExpiresAt(now);
  await prisma.resumeCode.create({
    data: {
      code,
      sessionId,
      accountId: accountId ?? null,
      createdAt: now,
      expiresAt,
    },
  });
  return code;
}

export async function prismaResolveResumeCode(codeRaw: string): Promise<ResumeCodeRecord | null> {
  const code = codeRaw.trim().toUpperCase();
  const row = await prisma.resumeCode.findUnique({ where: { code } });
  if (!row) return null;
  const record = asResumeRecord(row);
  if (isExpired(record)) {
    await prisma.resumeCode.delete({ where: { code } }).catch(() => undefined);
    return null;
  }
  return record;
}

export async function prismaGetResumeCodeForSession(
  sessionId: string,
): Promise<ResumeCodeRecord | null> {
  const row = await prisma.resumeCode.findFirst({ where: { sessionId } });
  if (!row) return null;
  const record = asResumeRecord(row);
  if (isExpired(record)) {
    await prisma.resumeCode.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return record;
}

export async function prismaPruneExpiredResumeCodes(): Promise<number> {
  const cutoff = new Date();
  // Prefer SQL-side delete for rows with expiresAt set; then sweep legacy.
  const withExpiry = await prisma.resumeCode.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  const legacy = await prisma.resumeCode.findMany({ where: { expiresAt: null } });
  let n = withExpiry.count;
  for (const row of legacy) {
    if (isExpired(asResumeRecord(row))) {
      await prisma.resumeCode.delete({ where: { id: row.id } });
      n += 1;
    }
  }
  return n;
}

export async function prismaListResumeCodesForAccount(
  accountId: string,
): Promise<ResumeCodeRecord[]> {
  const rows = await prisma.resumeCode.findMany({ where: { accountId } });
  return rows.map(asResumeRecord);
}

export async function prismaBindResumeCodeAccount(
  sessionId: string,
  accountId: string,
): Promise<void> {
  await prisma.resumeCode.updateMany({
    where: { sessionId },
    data: { accountId },
  });
}

export async function prismaClearAccountResumeCodes(accountId: string): Promise<number> {
  const result = await prisma.resumeCode.deleteMany({ where: { accountId } });
  return result.count;
}
