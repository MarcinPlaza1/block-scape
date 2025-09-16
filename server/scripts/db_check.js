import prisma from '../config/database.js';

async function main() {
  console.log('[db_check] DATABASE_URL:', process.env.DATABASE_URL);
  const tables = await prisma.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log('[db_check] tables:', tables.map(t => t.name).join(', '));

  const gameCols = await prisma.$queryRawUnsafe(`PRAGMA table_info('Game')`);
  console.log('[db_check] Game columns:', gameCols.map(c => c.name + ':' + c.type).join(', '));

  const likeCols = await prisma.$queryRawUnsafe(`PRAGMA table_info('Like')`).catch(() => []);
  console.log('[db_check] Like columns:', Array.isArray(likeCols) && likeCols.length ? likeCols.map(c => c.name + ':' + c.type).join(', ') : 'NOT_FOUND');

  const userCols = await prisma.$queryRawUnsafe(`PRAGMA table_info('User')`).catch(() => []);
  console.log('[db_check] User columns:', Array.isArray(userCols) && userCols.length ? userCols.map(c => c.name + ':' + c.type).join(', ') : 'NOT_FOUND');
}

main().catch(e => {
  console.error('[db_check] error', e);
}).finally(async () => {
  await prisma.$disconnect();
});

