-- Naughty Syntax Persistent Memory
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "memory_summary" TEXT;
ALTER TABLE "CharacterSession" ADD COLUMN IF NOT EXISTS "kink_profile" JSONB;
