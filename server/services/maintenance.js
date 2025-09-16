import prisma from '../config/database.js';

// Simple in-process maintenance scheduler
let intervals = [];

export function startMaintenanceJobs() {
  stopMaintenanceJobs();

  // Expired sessions cleanup: every 15 minutes
  intervals.push(setInterval(async () => {
    try {
      const result = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } }
      });
      if (result.count > 0) {
        console.log(`[maintenance] Removed ${result.count} expired sessions`);
      }
    } catch (err) {
      console.error('[maintenance] Failed to prune expired sessions', err);
    }
  }, 15 * 60 * 1000));

  // Retention cleanup: daily at ~24h interval
  intervals.push(setInterval(async () => {
    try {
      const now = new Date();

      // ChatMessage retention: 30 days
      const chatCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const chat = await prisma.chatMessage.deleteMany({
        where: { createdAt: { lt: chatCutoff } }
      });

      // PrivateMessage retention: 180 days
      const pmCutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const pm = await prisma.privateMessage.deleteMany({
        where: { createdAt: { lt: pmCutoff } }
      });

      // AuditLog retention: 90 days
      const auditCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const audit = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: auditCutoff } }
      });

      const total = chat.count + pm.count + audit.count;
      if (total > 0) {
        console.log(`[maintenance] Retention cleanup removed: chat=${chat.count}, pm=${pm.count}, audit=${audit.count}`);
      }
    } catch (err) {
      console.error('[maintenance] Retention cleanup failed', err);
    }
  }, 24 * 60 * 60 * 1000));
}

export function stopMaintenanceJobs() {
  intervals.forEach(id => clearInterval(id));
  intervals = [];
}


