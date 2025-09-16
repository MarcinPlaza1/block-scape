import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requireAuth } from 'server/middleware/auth.js';

// Minimal config stub
const ACCESS_SECRET = 'test-secret';

describe('requireAuth middleware', () => {
  function makeApp() {
    const app = express();
    app.get('/protected', requireAuth, (req, res) => res.json({ ok: true }));
    return app;
  }

  it('returns 401 when no token', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token invalid', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer invalid');
    expect(res.status).toBe(401);
  });
});


