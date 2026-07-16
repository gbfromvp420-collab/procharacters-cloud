-- Phase 2.5: dual-write surface — handle + billing on UserAccount, magic links, resume codes.

-- AlterTable UserAccount
ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "handle" TEXT;
ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "lastCheckoutSessionId" TEXT;

-- Backfill handle from credential when present
UPDATE "UserAccount" AS u
SET "handle" = c."handle"
FROM "AuthCredential" AS c
WHERE c."accountId" = u."id"
  AND (u."handle" IS NULL OR u."handle" = '');

UPDATE "UserAccount"
SET "handle" = 'user_' || substr("id", 1, 8)
WHERE "handle" IS NULL OR "handle" = '';

ALTER TABLE "UserAccount" ALTER COLUMN "handle" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserAccount_handle_key" ON "UserAccount"("handle");

-- CreateTable MagicLink
CREATE TABLE IF NOT EXISTS "MagicLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "linkAccountId" TEXT,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MagicLink_tokenHash_key" ON "MagicLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "MagicLink_email_idx" ON "MagicLink"("email");
CREATE INDEX IF NOT EXISTS "MagicLink_expiresAt_idx" ON "MagicLink"("expiresAt");
CREATE INDEX IF NOT EXISTS "MagicLink_linkAccountId_idx" ON "MagicLink"("linkAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MagicLink_linkAccountId_fkey'
  ) THEN
    ALTER TABLE "MagicLink"
      ADD CONSTRAINT "MagicLink_linkAccountId_fkey"
      FOREIGN KEY ("linkAccountId") REFERENCES "UserAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable ResumeCode
CREATE TABLE IF NOT EXISTS "ResumeCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ResumeCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResumeCode_code_key" ON "ResumeCode"("code");
CREATE INDEX IF NOT EXISTS "ResumeCode_sessionId_idx" ON "ResumeCode"("sessionId");
CREATE INDEX IF NOT EXISTS "ResumeCode_accountId_idx" ON "ResumeCode"("accountId");
CREATE INDEX IF NOT EXISTS "ResumeCode_expiresAt_idx" ON "ResumeCode"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResumeCode_accountId_fkey'
  ) THEN
    ALTER TABLE "ResumeCode"
      ADD CONSTRAINT "ResumeCode_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
