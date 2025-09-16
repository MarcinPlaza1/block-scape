import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler } from 'server/middleware/errorHandler.js';

describe('errorHandler middleware', () => {
  it('returns 404 with structured body for unknown route', async () => {
    const app = express();
    app.use(notFoundHandler);
    app.use(errorHandler);

    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Not Found' });
  });

  it('maps generic error to 500', async () => {
    const app = express();
    app.get('/boom', () => { throw new Error('boom'); });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
  });
});


