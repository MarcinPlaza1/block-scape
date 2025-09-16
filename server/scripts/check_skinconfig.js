// Check if the column `main.User.skinConfig` exists in the local SQLite DB
// Usage: node server/scripts/check_skinconfig.js

import prisma from '../config/database.js';

// Ensure DATABASE_URL is set (defaults to local dev db)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./server/prisma/dev.db';
}

// Use shared prisma instance from server/config/database.js

async function main() {
  try {
    const rows = await prisma.$queryRawUnsafe('PRAGMA table_info("User");');
    const columnNames = rows.map((r) => r.name);
    const exists = columnNames.includes('skinConfig');
    console.log(JSON.stringify({ table: 'User', columns: columnNames, skinConfigExists: exists }, null, 2));
  } finally {
    // Shared prisma is managed globally; do not disconnect here
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


