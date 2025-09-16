import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

function ensureSqliteUrl() {
  let url = process.env.DATABASE_URL || '';
  // Default to project dev DB if not provided
  if (!url) {
    url = 'file:./server/prisma/dev.db';
  }
  if (url.startsWith('file:')) {
    // Extract path part and resolve to absolute path
    let p = url.replace(/^file:/, '');
    // If path is relative, resolve from current working directory
    if (!path.isAbsolute(p)) {
      p = path.resolve(process.cwd(), p);
    }
    // Ensure directory exists
    const dir = path.dirname(p);
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    // Normalize to forward slashes for Prisma on Windows
    const normalized = p.replace(/\\/g, '/');
    process.env.DATABASE_URL = `file:${normalized}`;
  }
}

// Ensure DATABASE_URL is valid and directories exist (especially on Windows)
ensureSqliteUrl();
// Log resolved DATABASE_URL in development for diagnostics
if (process.env.NODE_ENV !== 'production') {
  try {
    console.log(`[backend] Prisma DATABASE_URL: ${process.env.DATABASE_URL}`);
  } catch {}
}

// Singleton pattern for PrismaClient
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn']
  });
} else {
  // In development, ensure we don't create multiple instances
  if (!global.prisma) {
    // Reduce noisy logs: keep only warnings and errors
    global.prisma = new PrismaClient({
      log: ['warn', 'error']
    });
  }
  prisma = global.prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
