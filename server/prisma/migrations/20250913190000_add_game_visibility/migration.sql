-- Add visibility column with default PRIVATE (SQLite)
PRAGMA foreign_keys=OFF;

-- Add column if not exists (best-effort)
ALTER TABLE "Game" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- Backfill from published flag
UPDATE "Game" SET "visibility" = 'PUBLIC' WHERE COALESCE("published", 0) = 1;
UPDATE "Game" SET "visibility" = 'PRIVATE' WHERE COALESCE("published", 0) = 0 AND ("visibility" IS NULL OR TRIM("visibility") = '');

-- Indexes for visibility queries
CREATE INDEX IF NOT EXISTS "Game_visibility_idx" ON "Game"("visibility");
CREATE INDEX IF NOT EXISTS "Game_owner_visibility_idx" ON "Game"("ownerId", "visibility");

PRAGMA foreign_keys=ON;

