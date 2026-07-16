import { prisma } from "../prisma.js";

export async function getAccountByEmail(email: string) {
  return prisma.userAccount.findUnique({ where: { email } });
}

function normalizeHandleSeed(email: string): string {
  const local = email.split("@")[0] ?? "user";
  let base = local.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  if (base.length < 3) base = `user${base}`.slice(0, 32);
  return base;
}

/**
 * Best-effort email row in Postgres (used for non-blocking sync from JSON auth).
 * Requires handle on UserAccount (phase 2.5).
 */
export async function upsertAccountByEmail(email: string) {
  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (existing) return existing;

  const base = normalizeHandleSeed(email);
  let handle = base;
  let i = 0;
  while (await prisma.userAccount.findUnique({ where: { handle } })) {
    i += 1;
    handle = `${base.slice(0, 24)}${i}`;
  }

  return prisma.userAccount.create({
    data: { email, handle },
  });
}
