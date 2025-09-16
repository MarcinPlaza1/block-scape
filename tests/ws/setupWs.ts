import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// Create a dedicated test SQLite database per run to avoid clobbering dev.db
const dbDir = path.resolve(process.cwd(), 'server', 'prisma');
const dbFile = path.join(dbDir, `test-${process.pid}.db`);

// Ensure directory exists
try { fs.mkdirSync(dbDir, { recursive: true }); } catch {}

// Normalize path for Prisma on Windows (forward slashes)
const normalizedPath = dbFile.replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${normalizedPath}`;

// Also ensure predictable secrets used by ws token utils
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'dev-access-secret';
}
if (!process.env.WS_SESSION_SECRET) {
  process.env.WS_SESSION_SECRET = 'dev-access-secret';
}

export function prepareTestDatabase() {
  // Use db push to sync schema into fresh test DB (faster and avoids migration history issues)
  const command = 'npx';
  const args = ['prisma', 'db', 'push', '--schema', 'server/prisma/schema.prisma', '--skip-generate'];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    const info = `code=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`;
    const err = new Error(`Failed to prepare test DB: ${info}`);
    throw err;
  }
}


