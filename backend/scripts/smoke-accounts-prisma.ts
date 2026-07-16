/**
 * Private smoke test for ACCOUNTS_PROVIDER=prisma path.
 *
 * Requires DATABASE_URL and migrated schema.
 * Does not touch production ACCOUNTS_PROVIDER — only talks to Postgres via Prisma bridges.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/smoke-accounts-prisma.ts
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  prismaCreateAccount,
  prismaDeleteAccount,
  prismaLoginAccount,
  prismaLogoutAccountToken,
  prismaRegisterResumeCode,
  prismaRequestMagicLink,
  prismaResolveAccountToken,
  prismaResolveResumeCode,
  prismaVerifyMagicLink,
} from "../src/lib/accounts/account-store-prisma.js";

function hashPassphrase(passphrase: string, salt: string): string {
  return scryptSync(passphrase, salt, 64).toString("hex");
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL required");
  }

  const handle = `smoke_${randomBytes(4).toString("hex")}`;
  const passphrase = "smoke-pass-123";
  const email = `${handle}@example.test`;

  console.log("[1] create account", handle);
  const created = await prismaCreateAccount(handle, passphrase, hashPassphrase);
  assert(created.token && created.id, "create returned token+id");

  console.log("[2] resolve token");
  const resolved = await prismaResolveAccountToken(created.token);
  assert(resolved?.id === created.id, "resolve after create");

  console.log("[3] logout + resolve null");
  await prismaLogoutAccountToken(created.token);
  const afterLogout = await prismaResolveAccountToken(created.token);
  assert(afterLogout === null, "token revoked");

  console.log("[4] login");
  const loggedIn = await prismaLoginAccount(handle, passphrase, hashPassphrase, safeEqualHex);
  assert(loggedIn.token, "login token");

  console.log("[5] resume code");
  const sessionId = `sess_${randomBytes(8).toString("hex")}`;
  const code = await prismaRegisterResumeCode(sessionId, loggedIn.id);
  const resume = await prismaResolveResumeCode(code);
  assert(resume?.sessionId === sessionId, "resume maps session");
  assert(resume?.accountId === loggedIn.id, "resume maps account");

  console.log("[6] magic link verify");
  const magic = await prismaRequestMagicLink(email);
  const verified = await prismaVerifyMagicLink(magic.token);
  assert(verified.token, "magic verify issues token");

  console.log("[7] cleanup delete accounts");
  await prismaDeleteAccount(created.id);
  // magic flow may have created/linked same or new account by email
  if (verified.id !== created.id) {
    await prismaDeleteAccount(verified.id);
  }

  console.log(JSON.stringify({ ok: true, handle, resumeCode: code }, null, 2));
}

main().catch((err) => {
  console.error("SMOKE FAILED", err);
  process.exit(1);
});
