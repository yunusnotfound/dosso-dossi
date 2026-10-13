import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@dosso-dossi/web-prisma';
import { hash, verify } from '@node-rs/argon2';
import express from 'express';
import request from 'supertest';
import { webTestDatabaseUrl } from '../config/web.js';
import { createCustomerAuthRouter, type CustomerAuthDependencies } from '../features/web/customer-auth.routes.js';
import { createCatalogRouter } from '../features/web/catalog.routes.js';
import { hashCustomerSession, hashCustomerToken, CUSTOMER_SESSION_TTL_SECONDS } from '../features/web/customer-auth.js';
import { CustomerMailConfigurationError, CustomerMailDeliveryError, type CustomerMailInput } from '../features/web/customer-mail.js';
import { errorHandler } from '../middleware/error-handler.js';

const target = webTestDatabaseUrl(process.env);
if (target !== process.env.WEB_INTEGRATION_DATABASE_URL) throw new Error('Web test DB seçimi uyuşmuyor.');
const database = new PrismaClient({ datasourceUrl: target });
let app: express.Express;
let time: number;
let messages: CustomerMailInput[];
let sendEmail: NonNullable<CustomerAuthDependencies['sendEmail']>;
const password = 'A memorable password';
const email = 'customer@example.test';
const input = { email, name: 'Web Customer', password, locale: 'tr' };
const body = (extra: Record<string, unknown> = {}) => ({ ...input, ...extra });
const emailBody = (address = email) => ({ email: address, locale: 'tr' });
const tokenOf = (purpose: 'verify-email' | 'reset-password') => messages.filter((message) => message.purpose === purpose).at(-1)!.token;
const login = (account = email, secret = password, targetApp = app) => request(targetApp).post('/web/auth/login').send({ email: account, password: secret });
function makeApp(overrides: CustomerAuthDependencies = {}) {
  const instance = express();
  instance.use('/web', createCustomerAuthRouter(() => database, { getMailConfiguration: () => ({ delivery: 'preview' }), sendEmail, now: () => new Date(time), ...overrides }));
  instance.use('/web', createCatalogRouter(() => database));
  instance.use(errorHandler);
  return instance;
}
async function registered() {
  const result = await request(app).post('/web/auth/register').send(body());
  expect(result.status).toBe(202);
  return tokenOf('verify-email');
}
async function verified() {
  const token = await registered();
  expect((await request(app).post('/web/auth/verify-email').send({ token, password })).status).toBe(200);
  return database.webCustomer.findUniqueOrThrow({ where: { email } });
}
beforeEach(async () => {
  await database.webCustomer.deleteMany();
  time = Date.now(); messages = [];
  sendEmail = vi.fn(async (message: CustomerMailInput) => { messages.push(message); return { delivery: 'preview' as const }; });
  app = makeApp();
});
afterAll(async () => { await database.webCustomer.deleteMany(); await database.$disconnect(); });

describe('isolated web customer email/password authentication', () => {
  it('normalizes identities, hashes passwords/tokens and requires email verification before login', async () => {
    const result = await request(app).post('/web/auth/register').send(body({ email: ' Customer@Example.Test ', name: ' Web Customer ' }));
    expect(result.status).toBe(202); expect(result.body).toEqual({ ok: true, delivery: 'preview' });
    expect(result.headers['cache-control']).toBe('no-store');
    const customer = await database.webCustomer.findUniqueOrThrow({ where: { email } });
    expect(customer.name).toBe('Web Customer'); expect(customer.locale).toBe('tr'); expect(customer.emailVerifiedAt).toBeNull();
    expect(customer.passwordHash).toMatch(/^\$argon2id\$/); expect(await verify(customer.passwordHash, password)).toBe(true);
    const pending = await database.webCustomerToken.findFirstOrThrow();
    expect(pending.tokenHash).toBe(hashCustomerToken(tokenOf('verify-email'), 'VERIFY_EMAIL'));
    expect(pending.tokenHash).not.toBe(tokenOf('verify-email'));
    expect(pending.expiresAt.getTime() - time).toBe(24 * 60 * 60 * 1000);
    expect((await login()).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await login(email, 'wrong')).status).toBe(401);
    expect(await database.webCustomerSession.count()).toBe(0);
    expect(JSON.stringify(result.body)).not.toMatch(/password|token|customer|email/i);
  });
  it('verifies once without auto-login and exposes only safe profile fields through seven-day sessions', async () => {
    const verification = await registered();
    const result = await request(app).post('/web/auth/verify-email').send({ token: verification, password });
    expect(result.body).toEqual({ ok: true }); expect(await database.webCustomerSession.count()).toBe(0);
    const signedIn = await login(); expect(signedIn.status).toBe(200);
    expect(Object.keys(signedIn.body.customer).sort()).toEqual(['email', 'emailVerifiedAt', 'id', 'locale', 'name']);
    const session = await database.webCustomerSession.findFirstOrThrow();
    expect(session.tokenHash).toBe(hashCustomerSession(signedIn.body.token));
    expect(session.expiresAt.getTime() - time).toBe(CUSTOMER_SESSION_TTL_SECONDS * 1000);
    const current = await request(app).get('/web/auth/session').set('Authorization', `Bearer ${signedIn.body.token}`);
    expect(current.body).toEqual({ customer: signedIn.body.customer });
    expect(JSON.stringify(current.body)).not.toMatch(/passwordHash|tokenHash|active|RequestedAt/);
    expect((await request(app).post('/web/auth/verify-email').send({ token: verification, password })).body.error.code).toBe('INVALID_TOKEN');
  });
  it('handles simultaneous verification exactly once', async () => {
    const token = await registered();
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/web/auth/verify-email').send({ token, password })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 400, 400]);
    expect(await database.webCustomerSession.count()).toBe(0);
  });
  it('expires verification links at 24 hours and allows a newly requested link', async () => {
    const oldToken = await registered(); time += 24 * 60 * 60 * 1000;
    expect((await request(app).post('/web/auth/verify-email').send({ token: oldToken, password })).status).toBe(400);
    expect((await request(app).post('/web/auth/resend-verification').send(emailBody())).status).toBe(202);
    expect(tokenOf('verify-email')).not.toBe(oldToken);
    expect((await request(app).post('/web/auth/verify-email').send({ token: tokenOf('verify-email'), password })).status).toBe(200);
  });
  it('preserves an existing customer password and profile across duplicate registration', async () => {
    const customer = await verified(); time += 61_000;
    const duplicate = await request(app).post('/web/auth/register').send(body({ password: 'different password here', name: 'Overwrite attempt', locale: 'en' }));
    expect(duplicate.body).toEqual({ ok: true, delivery: 'preview' });
    expect(await database.webCustomer.findUniqueOrThrow({ where: { email } })).toEqual(customer);
    expect(messages).toHaveLength(1); expect((await login()).status).toBe(200);
    expect((await login(email, 'different password here')).status).toBe(401);
  });
  it('lets the email owner replace a pre-registered password during verification', async () => {
    const attackerPassword = 'pre-registered password';
    expect((await request(app).post('/web/auth/register').send(body({ password: attackerPassword }))).status).toBe(202);
    time += 61_000;
    expect((await request(app).post('/web/auth/register').send(body({ password }))).status).toBe(202);
    // Duplicate registration deliberately did not overwrite an existing hash.
    expect(await verify((await database.webCustomer.findUniqueOrThrow({ where: { email } })).passwordHash, attackerPassword)).toBe(true);
    const activation = await request(app).post('/web/auth/verify-email').send({ token: tokenOf('verify-email'), password });
    expect(activation.status).toBe(200);
    expect((await login(email, attackerPassword)).status).toBe(401);
    expect((await login()).status).toBe(200);
  });
  it('serializes duplicate registration races without overwrite or duplicate emails across router instances', async () => {
    const other = makeApp();
    const responses = await Promise.all([
      request(app).post('/web/auth/register').send(body({ password: 'first long password' })),
      request(other).post('/web/auth/register').send(body({ password: 'second long password' })),
    ]);
    expect(responses.map((result) => result.status)).toEqual([202, 202]);
    expect(await database.webCustomer.count()).toBe(1); expect(messages).toHaveLength(1);
    const customer = await database.webCustomer.findUniqueOrThrow({ where: { email } });
    const valid = await Promise.all(['first long password', 'second long password'].map((secret) => verify(customer.passwordHash, secret)));
    expect(valid.filter(Boolean)).toHaveLength(1);
  });
  it('gives identical resend/forgot responses for unknown, verified and unverified accounts', async () => {
    await registered();
    const unknown = await request(app).post('/web/auth/resend-verification').send(emailBody('unknown@example.test'));
    time += 61_000;
    const unverified = await request(app).post('/web/auth/resend-verification').send(emailBody());
    expect(unverified.body).toEqual(unknown.body);
    expect((await request(app).post('/web/auth/forgot-password').send(emailBody())).body).toEqual(unknown.body);
    expect(messages.filter((message) => message.purpose === 'reset-password')).toHaveLength(0);
    await request(app).post('/web/auth/verify-email').send({ token: tokenOf('verify-email'), password }); time += 61_000;
    expect((await request(app).post('/web/auth/resend-verification').send(emailBody())).body).toEqual(unknown.body);
    const resetKnown = await request(app).post('/web/auth/forgot-password').send(emailBody());
    const resetUnknown = await request(app).post('/web/auth/forgot-password').send(emailBody('another@example.test'));
    expect(resetKnown.body).toEqual(resetUnknown.body);
  });
  it('enforces a 60-second shared registration/resend cooldown without blocking other email addresses', async () => {
    await registered();
    const limited = await request(app).post('/web/auth/resend-verification').send(emailBody('CUSTOMER@example.test'));
    expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBe('60');
    expect((await request(app).post('/web/auth/register').send(body({ email: 'second@example.test' }))).status).toBe(202);
    time += 60_000;
    expect((await request(app).post('/web/auth/resend-verification').send(emailBody())).status).toBe(202);
    expect(messages.filter((message) => message.to === email)).toHaveLength(2);
  });
  it('keeps its send cooldown across router restarts through PostgreSQL', async () => {
    await registered();
    expect((await request(makeApp()).post('/web/auth/resend-verification').send(emailBody())).status).toBe(202);
    expect(messages).toHaveLength(1);
  });
  it('makes mail failure recoverable without exposing accounts or invalidating an earlier valid link', async () => {
    const originalToken = await registered(); time += 61_000;
    const failingApp = makeApp({ sendEmail: async () => { throw new CustomerMailDeliveryError(); } });
    const failure = await request(failingApp).post('/web/auth/resend-verification').send(emailBody());
    expect(failure.status).toBe(202); expect(failure.body).toEqual({ ok: true, delivery: 'preview' });
    expect(await database.webCustomerToken.count()).toBe(1);
    expect((await database.webCustomerToken.findFirstOrThrow()).tokenHash).toBe(hashCustomerToken(originalToken, 'VERIFY_EMAIL'));
    expect((await request(makeApp()).post('/web/auth/resend-verification').send(emailBody())).status).toBe(202);
    expect(messages).toHaveLength(2);
    expect((await request(app).post('/web/auth/verify-email').send({ token: originalToken, password })).status).toBe(200);
    expect((await request(app).post('/web/auth/verify-email').send({ token: tokenOf('verify-email'), password })).status).toBe(400);
  });
  it('keeps a new registration recoverable when its first mail attempt fails', async () => {
    let attempts = 0;
    const recovering = makeApp({ sendEmail: async (message) => {
      attempts += 1; if (attempts === 1) throw new CustomerMailDeliveryError();
      messages.push(message); return { delivery: 'preview' };
    } });
    expect((await request(recovering).post('/web/auth/register').send(body())).status).toBe(202);
    expect(await database.webCustomer.count()).toBe(1); expect(await database.webCustomerToken.count()).toBe(0);
    expect((await request(recovering).post('/web/auth/resend-verification').send(emailBody())).status).toBe(429);
    time += 60_000;
    expect((await request(recovering).post('/web/auth/resend-verification').send(emailBody())).status).toBe(202);
    expect(messages).toHaveLength(1); expect(attempts).toBe(2);
  });
  it('retains identical cooldown behavior for provider failures and unknown accounts', async () => {
    await registered(); time += 61_000;
    const unavailable = makeApp({ sendEmail: async () => { throw new CustomerMailDeliveryError(); } });
    const known = await request(unavailable).post('/web/auth/resend-verification').send(emailBody());
    const unknown = await request(unavailable).post('/web/auth/resend-verification').send(emailBody('unknown@example.test'));
    expect(known.status).toBe(202); expect(known.body).toEqual(unknown.body);
    const knownRetry = await request(unavailable).post('/web/auth/resend-verification').send(emailBody());
    const unknownRetry = await request(unavailable).post('/web/auth/resend-verification').send(emailBody('unknown@example.test'));
    expect(knownRetry.status).toBe(429); expect(knownRetry.body).toEqual(unknownRetry.body);
    expect(knownRetry.headers['retry-after']).toBe(unknownRetry.headers['retry-after']);
  });
  it('fails closed identically for every mail request when configuration is unavailable', async () => {
    const unavailable = makeApp({ getMailConfiguration: () => { throw new CustomerMailConfigurationError(); } });
    for (const [route, data] of [['register', body()], ['resend-verification', emailBody()], ['forgot-password', emailBody('unknown@example.test')]] as const) {
      const result = await request(unavailable).post(`/web/auth/${route}`).send(data);
      expect(result.status).toBe(503); expect(result.body.error.code).toBe('WEB_EMAIL_UNAVAILABLE');
    }
    expect(await database.webCustomer.count()).toBe(0); expect(messages).toHaveLength(0);
  });
  it('resets a password once and revokes every existing customer session', async () => {
    await verified();
    const sessions = [(await login()).body.token, (await login()).body.token];
    expect((await request(app).post('/web/auth/forgot-password').send(emailBody())).status).toBe(202);
    const token = tokenOf('reset-password');
    const pending = await database.webCustomerToken.findFirstOrThrow({ where: { purpose: 'RESET_PASSWORD' } });
    expect(pending.expiresAt.getTime() - time).toBe(60 * 60 * 1000);
    expect((await request(app).post('/web/auth/reset-password').send({ token, password: 'replacement password' })).status).toBe(200);
    expect(await database.webCustomerSession.count()).toBe(0);
    for (const session of sessions) expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${session}`)).status).toBe(401);
    expect((await login()).status).toBe(401); expect((await login(email, 'replacement password')).status).toBe(200);
    expect((await request(app).post('/web/auth/reset-password').send({ token, password: 'another replacement' })).body.error.code).toBe('INVALID_TOKEN');
  });
  it('serializes simultaneous resets and invalidates all other outstanding reset links', async () => {
    await verified();
    await request(app).post('/web/auth/forgot-password').send(emailBody()); const first = tokenOf('reset-password');
    time += 61_000; await request(app).post('/web/auth/forgot-password').send(emailBody()); const second = tokenOf('reset-password');
    const results = await Promise.all([first, second].map((token) => request(app).post('/web/auth/reset-password').send({ token, password: 'new shared password' })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    expect((await login(email, 'new shared password')).status).toBe(200);
  });
  it('expires reset tokens after one hour and cannot interchange reset and verification tokens', async () => {
    const verificationToken = await registered();
    expect((await request(app).post('/web/auth/reset-password').send({ token: verificationToken, password: 'new replacement password' })).status).toBe(400);
    await request(app).post('/web/auth/verify-email').send({ token: verificationToken, password });
    await request(app).post('/web/auth/forgot-password').send(emailBody()); const resetToken = tokenOf('reset-password');
    expect((await request(app).post('/web/auth/verify-email').send({ token: resetToken, password })).status).toBe(400);
    time += 60 * 60 * 1000;
    expect((await request(app).post('/web/auth/reset-password').send({ token: resetToken, password: 'new replacement password' })).status).toBe(400);
    expect((await login()).status).toBe(200);
  });
  it('prevents old-password logins racing a password reset from leaving a valid session', async () => {
    await verified(); await request(app).post('/web/auth/forgot-password').send(emailBody());
    const [signedIn, reset] = await Promise.all([
      login(), request(app).post('/web/auth/reset-password').send({ token: tokenOf('reset-password'), password: 'replacement password' }),
    ]);
    expect(reset.status).toBe(200);
    if (signedIn.status === 200) expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${signedIn.body.token}`)).status).toBe(401);
    else expect(signedIn.status).toBe(401);
    expect((await login(email, 'replacement password')).status).toBe(200);
  });
  it('logs out and rejects expired or disabled customer sessions', async () => {
    await verified(); const first = (await login()).body.token;
    expect((await request(app).post('/web/auth/logout').set('Authorization', `Bearer ${first}`).send({})).status).toBe(204);
    expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${first}`)).status).toBe(401);
    const second = (await login()).body.token; time += CUSTOMER_SESSION_TTL_SECONDS * 1000;
    expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${second}`)).status).toBe(401);
    const third = (await login()).body.token; await database.webCustomer.updateMany({ data: { active: false } });
    expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${third}`)).status).toBe(401);
    expect((await login()).status).toBe(401);
  });
  it('keeps customer, administrator and mobile authentication separate even with matching email addresses', async () => {
    await verified(); const customerToken = (await login()).body.token;
    const adminEmail = 'realm-check@example.test';
    const admin = await database.webAdmin.create({ data: { email: adminEmail, name: 'Realm check', passwordHash: await hash(password) } });
    try {
      const adminLogin = await request(app).post('/web/admin/auth/login').send({ email: adminEmail, password });
      expect(adminLogin.status).toBe(200);
      expect((await request(app).get('/web/auth/session').set('Authorization', `Bearer ${adminLogin.body.token}`)).status).toBe(401);
      expect((await request(app).get('/web/admin/products').set('Authorization', `Bearer ${customerToken}`)).status).toBe(401);
      expect((await request(app).get('/web/auth/session').set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.mobile.signature')).status).toBe(401);
      expect((await login(adminEmail)).status).toBe(401);
      const tables = await database.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
      expect(tables.every(({ tablename }) => tablename.startsWith('Web') || tablename === '_prisma_migrations')).toBe(true);
    } finally { await database.webAdmin.delete({ where: { id: admin.id } }); }
  });
  it('rate limits failed accounts independently and resets the budget after correct logins', async () => {
    await verified();
    for (let i = 0; i < 10; i++) expect((await login('blocked@example.test', 'wrong')).status).toBe(401);
    expect((await login('BLOCKED@example.test', 'wrong')).status).toBe(429);
    for (let i = 0; i < 9; i++) expect((await login(email, 'wrong')).status).toBe(401);
    expect((await login()).status).toBe(200);
    for (let i = 0; i < 9; i++) expect((await login(email, 'wrong')).status).toBe(401);
    expect((await login()).status).toBe(200);
  });
  it('caps aggregate traffic without trusting spoofed forwarded addresses', async () => {
    for (let i = 0; i < 300; i++) {
      const result = await request(app).post('/web/auth/login').set('X-Forwarded-For', `192.0.2.${i % 255}`).send({});
      expect(result.status).toBe(400);
    }
    const limited = await request(app).post('/web/auth/login').set('X-Forwarded-For', '203.0.113.1').send({});
    expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBeDefined();
  });
  it('rejects short/long passwords, unknown fields, malformed tokens and large/non-JSON bodies', async () => {
    for (const extra of [{ password: 'short' }, { password: 'x'.repeat(129) }, { name: 'x' }, { locale: 'de' }, { admin: true }, { email: 'not-an-email' }]) {
      expect((await request(app).post('/web/auth/register').send(body(extra))).status).toBe(400);
    }
    expect((await request(app).post('/web/auth/verify-email').send({ token: 'invalid' })).status).toBe(400);
    expect((await request(app).post('/web/auth/register').send(body({ name: 'x'.repeat(5000) }))).status).toBe(413);
    expect((await request(app).post('/web/auth/register').set('Content-Type', 'text/plain').send(JSON.stringify(body()))).status).toBe(415);
    expect(await database.webCustomer.count()).toBe(0);
  });
});
