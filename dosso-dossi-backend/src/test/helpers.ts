import type { Express } from 'express';
import request from 'supertest';

/// Dev master koduyla giriş yapıp Bearer token döner.
export async function login(app: Express, phone: string): Promise<string> {
  const res = await request(app)
    .post('/auth/otp/verify')
    .send({ phone, code: '111111' });
  if (res.status !== 200) {
    throw new Error(`Test girişi başarısız: ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}
