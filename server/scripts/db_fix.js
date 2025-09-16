import { execSync } from 'node:child_process';
import prisma from '../config/database.js';

async function hasColumn(table, col) {
  try {
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${table}')`);
    return Array.isArray(rows) && rows.some(r => (r.name || r.COLUMN_NAME) === col);
  } catch {
    return false;
  }
}

async function hasTable(table) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function verifySchema() {
  const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  const tableNames = tables.map(t => t.name);
  const gameHasPublished = await hasColumn('Game', 'published');
  const likeExists = await hasTable('Like');
  const migrationsTable = await hasTable('_prisma_migrations');
  let failedMigrations = [];
  if (migrationsTable) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count, migration_steps_count FROM _prisma_migrations`
      );
      failedMigrations = rows
        .filter(r => !r.finished_at || r.rolled_back_at || (r.applied_steps_count ?? 0) < (r.migration_steps_count ?? 0))
        .map(r => r.migration_name);
    } catch {}
  }
  return { tableNames, gameHasPublished, likeExists, migrationsTable, failedMigrations };
}

async function main() {
  console.log('[db_fix] DATABASE_URL:', process.env.DATABASE_URL);
  // 1) Try deploy
  try {
    execSync('npx prisma migrate deploy --schema server/prisma/schema.prisma', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[db_fix] migrate deploy failed, continuing to check schema');
  }

  let status = await verifySchema();
  console.log('[db_fix] status after deploy:', status);

  // 1a) Resolve any failed migrations by marking them as applied (dev convenience)
  if (status.failedMigrations && status.failedMigrations.length > 0) {
    for (const name of status.failedMigrations) {
      try {
        console.warn(`[db_fix] Resolving failed migration as applied: ${name}`);
        execSync(`npx prisma migrate resolve --applied ${name} --schema server/prisma/schema.prisma`, { stdio: 'inherit' });
      } catch (e) {
        console.error('[db_fix] migrate resolve failed for', name, e.message || e);
      }
    }
    // Re-run deploy after resolve
    try {
      execSync('npx prisma migrate deploy --schema server/prisma/schema.prisma', { stdio: 'inherit' });
    } catch {
      console.warn('[db_fix] migrate deploy still failing after resolve');
    }
    status = await verifySchema();
  }

  const needsReset = !status.migrationsTable || !status.gameHasPublished || !status.likeExists;
  if (needsReset) {
    console.warn('[db_fix] Schema incomplete -> performing prisma migrate reset');
    try {
      execSync('npx prisma migrate reset --force --skip-generate --schema server/prisma/schema.prisma', { stdio: 'inherit' });
    } catch (e) {
      console.error('[db_fix] migrate reset failed', e.message || e);
    }
  }

  // 2) Seed always to ensure admin/demo
  try {
    execSync('npx prisma db seed --schema server/prisma/schema.prisma', { stdio: 'inherit' });
  } catch (e) {
    console.error('[db_fix] seed failed', e.message || e);
  }

  status = await verifySchema();
  console.log('[db_fix] final status:', status);
}

main().catch(e => {
  console.error('[db_fix] error', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

