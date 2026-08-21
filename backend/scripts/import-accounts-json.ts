/**
 * Import accounts.json → Postgres (phase 2.5 cutover helper).
 *
 * Usage (from backend/):
 *   DATABASE_URL=... npx tsx scripts/import-accounts-json.ts [--path ../data/accounts.json] [--dry-run]
 *
 * Imports:
 *   - accounts + credentials (salt$hash)
 *   - resume codes
 *   - active (unexpired, unconsumed) magic links
 *
 * Does NOT re-import bearer tokens (users re-login after cutover).
 * Idempotent on handle / email / resume code (skips existing).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type AccountPlan = "free" | "day_pass" | "supporter";

interface AccountRecord {
  id: string;
  handle: string;
  passphraseHash?: string;
  salt?: string;
  email?: string;
  createdAt: string;
  plan?: AccountPlan;
  planExpiresAt?: string;
  stripeCustomerId?: string;
  lastCheckoutSessionId?: string;
}

interface ResumeCodeRecord {
  code: string;
  sessionId: string;
  accountId?: string;
  createdAt: string;
  expiresAt?: string;
}

interface MagicLinkRecord {
  tokenHash: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  linkAccountId?: string;
}

interface AccountFile {
  version: 1;
  accounts: AccountRecord[];
  tokens?: unknown[];
  resumeCodes?: ResumeCodeRecord[];
  magicLinks?: MagicLinkRecord[];
}

function parseArgs(argv: string[]) {
  let path = process.env.ACCOUNTS_PATH?.trim() || resolve(process.cwd(), "../data/accounts.json");
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--path" && argv[i + 1]) {
      path = resolve(argv[++i]!);
    }
  }
  return { path, dryRun };
}

function normalizeHandle(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  const { path, dryRun } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const raw = await readFile(path, "utf8");
  const file = JSON.parse(raw) as AccountFile;
  const accounts = file.accounts ?? [];
  const resumeCodes = file.resumeCodes ?? [];
  const magicLinks = (file.magicLinks ?? []).filter(
    (m) => !m.consumedAt && new Date(m.expiresAt).getTime() > Date.now(),
  );

  console.log(
    JSON.stringify(
      {
        path,
        dryRun,
        accounts: accounts.length,
        resumeCodes: resumeCodes.length,
        activeMagicLinks: magicLinks.length,
        tokensSkipped: (file.tokens ?? []).length,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run — no writes.");
    return;
  }

  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const idMap = new Map<string, string>(); // json id → prisma id
  let accountsCreated = 0;
  let accountsSkipped = 0;
  let resumesCreated = 0;
  let resumesSkipped = 0;
  let magicsCreated = 0;
  let magicsSkipped = 0;

  try {
    for (const acc of accounts) {
      const handle = normalizeHandle(acc.handle);
      if (handle.length < 3) {
        console.warn(`skip account ${acc.id}: invalid handle "${acc.handle}"`);
        accountsSkipped += 1;
        continue;
      }
      const email = acc.email ? normalizeEmail(acc.email) : null;

      const existingByHandle = await prisma.userAccount.findUnique({ where: { handle } });
      if (existingByHandle) {
        idMap.set(acc.id, existingByHandle.id);
        accountsSkipped += 1;
        continue;
      }
      if (email) {
        const existingByEmail = await prisma.userAccount.findUnique({ where: { email } });
        if (existingByEmail) {
          idMap.set(acc.id, existingByEmail.id);
          accountsSkipped += 1;
          continue;
        }
      }

      const created = await prisma.userAccount.create({
        data: {
          // Keep original ids when they look like cuid/hex; otherwise generate.
          id: acc.id?.length >= 8 ? acc.id : undefined,
          handle,
          email: email ?? undefined,
          createdAt: acc.createdAt ? new Date(acc.createdAt) : undefined,
          plan: acc.plan && acc.plan !== "free" ? acc.plan : undefined,
          planExpiresAt: acc.planExpiresAt ? new Date(acc.planExpiresAt) : undefined,
          stripeCustomerId: acc.stripeCustomerId,
          lastCheckoutSessionId: acc.lastCheckoutSessionId,
          ...(acc.passphraseHash && acc.salt
            ? {
                credentials: {
                  create: {
                    handle,
                    passphraseHash: `${acc.salt}$${acc.passphraseHash}`,
                  },
                },
              }
            : {}),
        },
      });
      idMap.set(acc.id, created.id);
      accountsCreated += 1;
    }

    for (const code of resumeCodes) {
      const c = code.code?.toUpperCase?.() ?? "";
      if (!c) continue;
      const existing = await prisma.resumeCode.findUnique({ where: { code: c } });
      if (existing) {
        resumesSkipped += 1;
        continue;
      }
      const accountId = code.accountId ? idMap.get(code.accountId) : undefined;
      await prisma.resumeCode.create({
        data: {
          code: c,
          sessionId: code.sessionId,
          accountId: accountId ?? null,
          createdAt: code.createdAt ? new Date(code.createdAt) : new Date(),
          expiresAt: code.expiresAt ? new Date(code.expiresAt) : null,
        },
      });
      resumesCreated += 1;
    }

    for (const magic of magicLinks) {
      const existing = await prisma.magicLink.findUnique({
        where: { tokenHash: magic.tokenHash },
      });
      if (existing) {
        magicsSkipped += 1;
        continue;
      }
      const linkAccountId = magic.linkAccountId ? (idMap.get(magic.linkAccountId) ?? null) : null;
      await prisma.magicLink.create({
        data: {
          tokenHash: magic.tokenHash,
          email: normalizeEmail(magic.email),
          createdAt: new Date(magic.createdAt),
          expiresAt: new Date(magic.expiresAt),
          linkAccountId,
        },
      });
      magicsCreated += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          accountsCreated,
          accountsSkipped,
          resumesCreated,
          resumesSkipped,
          magicsCreated,
          magicsSkipped,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
