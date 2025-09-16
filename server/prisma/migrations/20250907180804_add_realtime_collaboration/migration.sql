-- CreateTable
CREATE TABLE "RealtimeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "RealtimeSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RealtimeSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RealtimeParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "role" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "presenceData" TEXT,
    CONSTRAINT "RealtimeParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RealtimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RealtimeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RealtimeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "id", "ip", "metadata", "userAgent", "userId") SELECT "action", "createdAt", "id", "ip", "metadata", "userAgent", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "blocks" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("blocks", "createdAt", "id", "name", "ownerId", "published", "thumbnail", "updatedAt") SELECT "blocks", "createdAt", "id", "name", "ownerId", "published", "thumbnail", "updatedAt" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RealtimeSession_gameId_idx" ON "RealtimeSession"("gameId");

-- CreateIndex
CREATE INDEX "RealtimeSession_ownerId_idx" ON "RealtimeSession"("ownerId");

-- CreateIndex
CREATE INDEX "RealtimeSession_isActive_idx" ON "RealtimeSession"("isActive");

-- CreateIndex
CREATE INDEX "RealtimeParticipant_sessionId_idx" ON "RealtimeParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "RealtimeParticipant_userId_idx" ON "RealtimeParticipant"("userId");

-- CreateIndex
CREATE INDEX "RealtimeParticipant_isOnline_idx" ON "RealtimeParticipant"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "RealtimeParticipant_sessionId_userId_key" ON "RealtimeParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");
