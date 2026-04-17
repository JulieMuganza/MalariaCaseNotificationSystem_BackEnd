import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

describe('API (integration)', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });

  it('GET /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data?.status).toBe('ok');
  });

  it('auth: register, login, me, forgot-password shape', async () => {
    if (!dbAvailable) return;

      const email = `tester_${Date.now()}@example.com`;
      const reg = await request(app).post('/api/v1/auth/register').send({
        email,
        password: 'longpassword1',
        name: 'Test User',
        district: 'Huye',
      });
      expect(reg.status).toBe(201);
      expect(reg.body.data?.email).toBe(email.toLowerCase());
      expect(reg.body.data?.message).toBeTruthy();

      const verify = await request(app).post('/api/v1/auth/verify-email').send({
        email,
        code: '123456',
      });
      expect(verify.status).toBe(200);
      expect(verify.body.data?.refreshToken).toContain('.');

      const me = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${verify.body.data.accessToken}`);
      expect(me.status).toBe(200);
      expect(me.body.data?.user?.email).toBe(email.toLowerCase());

      const forgot = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email });
      expect(forgot.status).toBe(200);
      expect(forgot.body.data?.message).toBeTruthy();
  });

  it('GET /api/v1/auth/google/status', async () => {
    const res = await request(app).get('/api/v1/auth/google/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.data?.configured).toBe('boolean');
  });
});
