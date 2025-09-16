import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';

function getEnv(name, fallback) {
  return process.env[name] && process.env[name].length > 0
    ? process.env[name]
    : fallback;
}

async function ensureUser({ email, name, password, role = 'USER' }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role,
        passwordHash,
      },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash,
    },
  });
}

async function ensureSampleGame(ownerId) {
  const existing = await prisma.game.findFirst({ where: { ownerId } });
  if (existing) return existing;
  return prisma.game.create({
    data: {
      name: 'Demo World',
      blocks: '[]',
      published: true,
      ownerId,
    },
  });
}

async function main() {
  const adminEmail = getEnv('ADMIN_EMAIL', 'admin@example.com');
  const adminPassword = getEnv('ADMIN_PASSWORD', 'admin123');
  const userEmail = getEnv('DEMO_USER_EMAIL', 'user@example.com');
  const userPassword = getEnv('DEMO_USER_PASSWORD', 'user123');

  const admin = await ensureUser({
    email: adminEmail,
    name: 'Admin',
    password: adminPassword,
    role: 'ADMIN',
  });

  const user = await ensureUser({
    email: userEmail,
    name: 'Demo User',
    password: userPassword,
    role: 'USER',
  });

  await ensureSampleGame(admin.id);

  console.log('[seed] done', { admin: admin.email, user: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


