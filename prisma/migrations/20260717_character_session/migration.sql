-- Phase 5: durable CharacterSession (per account + character memory)

CREATE TABLE IF NOT EXISTS "CharacterSession" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memorySummary" TEXT,
    "kinkProfile" JSONB,
    "history" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterSession_pkey" PRIMARY KEY ("id")
);

-- If an older stub existed without columns, add them safely
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "memorySummary" TEXT;
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "kinkProfile" JSONB;
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "history" JSONB DEFAULT '[]';
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER DEFAULT 0;
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "lastSessionId" TEXT;

-- Normalize nullable userId from early stubs (drop guest rows)
DELETE FROM "CharacterSession" WHERE "userId" IS NULL OR "userId" = '';

CREATE UNIQUE INDEX IF NOT EXISTS "CharacterSession_userId_characterId_key"
  ON "CharacterSession"("userId", "characterId");
CREATE INDEX IF NOT EXISTS "CharacterSession_characterId_idx"
  ON "CharacterSession"("characterId");
CREATE INDEX IF NOT EXISTS "CharacterSession_updatedAt_idx"
  ON "CharacterSession"("updatedAt");
