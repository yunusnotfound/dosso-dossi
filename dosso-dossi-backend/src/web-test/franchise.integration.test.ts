import { afterAll, beforeEach, expect, it } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import express from 'express';
import request from 'supertest';
import { webTestDatabaseUrl } from '../config/web.js';
import { createFranchiseRouter } from '../features/web/franchise.routes.js';
import { hashSession } from '../features/web/admin-auth.js';
import { errorHandler } from '../middleware/error-handler.js';
const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test database mismatch.');
const database = new PrismaClient({ datasourceUrl: target });
const adminToken = 'f'.repeat(64), editorToken = 'g'.repeat(64);
let app: express.Express;
async function clear() { await database.webFranchiseInquiry.deleteMany(); await database.webAdmin.deleteMany(); }
beforeEach(async () => {
  await clear();
  for (const [role, token] of [['ADMIN', adminToken], ['EDITOR', editorToken]] as const) await database.webAdmin.create({ data: { email: `franchise-${role}@example.test`, name: role, role, passwordHash: 'test-only', sessions: { create: { tokenHash: hashSession(token), expiresAt: new Date(Date.now() + 3600000) } } } });
  app = express(); app.use('/web', createFranchiseRouter(() => database)); app.use(errorHandler);
});
afterAll(async () => { await clear(); await database.$disconnect(); });
it('persists a consented inquiry and protects private details behind ADMIN auth with optimistic locking', async () => {
  const submitted = await request(app).post('/web/franchise-inquiries').send({ name: 'Test Customer', email: 'lead@example.test', phone: '0532 123 45 67', city: 'İstanbul', space: 'UNDECIDED', experience: 'FIRST', message: 'Bir şube açmak istiyorum; bilgi rica ederim.', privacyAcknowledged: true });
  expect(submitted.status).toBe(201); expect(Object.keys(submitted.body)).toEqual(['receipt']);
  const saved = await database.webFranchiseInquiry.findUniqueOrThrow({ where: { receipt: submitted.body.receipt } });
  expect(saved.privacyAcknowledgedAt).toBeInstanceOf(Date); expect(saved.status).toBe('NEW');
  expect((await request(app).get('/web/admin/franchise-inquiries')).status).toBe(401);
  expect((await request(app).get('/web/admin/franchise-inquiries').set('Authorization', `Bearer ${editorToken}`)).status).toBe(403);
  const auth = { Authorization: `Bearer ${adminToken}` };
  const listing = await request(app).get('/web/admin/franchise-inquiries?status=NEW').set(auth);
  expect(listing.body.inquiries).toHaveLength(1); expect(listing.body.total).toBe(1);
  expect((await request(app).patch(`/web/admin/franchise-inquiries/${saved.id}`).set(auth).send({ version: 1, status: 'IN_REVIEW', note: 'Telefon görüşmesi planlanacak.' })).status).toBe(200);
  expect((await request(app).patch(`/web/admin/franchise-inquiries/${saved.id}`).set(auth).send({ version: 1, status: 'CLOSED', note: 'Eski sürüm' })).status).toBe(409);
  expect((await database.webFranchiseInquiry.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe('IN_REVIEW');
});
