-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "blocks" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "thumbnail" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'PARKOUR',
    "modeConfig" TEXT,
    "terrain" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("blocks", "createdAt", "id", "name", "ownerId", "published", "thumbnail", "updatedAt", "visibility") SELECT "blocks", "createdAt", "id", "name", "ownerId", "published", "thumbnail", "updatedAt", "visibility" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
