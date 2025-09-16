-- CreateTable
CREATE TABLE "GameView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "dailyKey" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameView_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GameView_gameId_idx" ON "GameView"("gameId");

-- CreateIndex
CREATE INDEX "GameView_dailyKey_idx" ON "GameView"("dailyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GameView_gameId_dailyKey_viewerKey_key" ON "GameView"("gameId", "dailyKey", "viewerKey");
