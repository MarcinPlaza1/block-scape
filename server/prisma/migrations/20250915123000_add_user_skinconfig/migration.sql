-- AlterTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- SQLite supports adding columns directly
ALTER TABLE "User" ADD COLUMN "skinConfig" TEXT;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


