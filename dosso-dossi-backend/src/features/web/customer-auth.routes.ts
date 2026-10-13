import express, { Router, type ErrorRequestHandler } from 'express';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { loginRateLimit } from './admin-auth.js';
import {
  CustomerAuthError, customerLogin, customerSessionToken, hashCustomerSession,
  issueCustomerToken, registerCustomer, releaseCustomerToken, requireWebCustomer,
  resetCustomerPassword, verifyCustomerEmail,
} from './customer-auth.js';
import { customerEmailInput, customerLoginInput, customerRegisterInput, customerResetInput, customerVerifyInput } from './customer-auth.schemas.js';
import { CustomerMailConfigurationError, getCustomerMailConfiguration, sendCustomerEmail } from './customer-mail.js';
import { customerEmailRateLimit } from './customer-rate-limit.js';

export interface CustomerAuthDependencies {
  getMailConfiguration?: () => Pick<ReturnType<typeof getCustomerMailConfiguration>, 'delivery'>;
  sendEmail?: typeof sendCustomerEmail;
  now?: () => Date;
}

export function createCustomerAuthRouter(database: () => PrismaClient, dependencies: CustomerAuthDependencies = {}): Router {
  const router = Router();
  const now = dependencies.now ?? (() => new Date());
  const configureMail = dependencies.getMailConfiguration ?? getCustomerMailConfiguration;
  const sendEmail = dependencies.sendEmail ?? sendCustomerEmail;
  // New limiter instances keep customer budgets separate from administrator ones.
  const loginLimiter = loginRateLimit();
  const emailLimiter = customerEmailRateLimit(now);
  router.use('/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use('/auth', (req, res, next) => {
    if (req.method !== 'POST') { next(); return; }
    loginLimiter.aggregate(req, res, (error) => {
      if (error) { next(error); return; }
      if (!req.is('application/json')) {
        res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'JSON içerik türü gerekli.' } }); return;
      }
      express.json({ limit: '4kb' })(req, res, next);
    });
  });

  async function deliver(customerId: string | undefined, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD', locale: 'tr' | 'en') {
    if (!customerId) return;
    const claim = await issueCustomerToken(database(), customerId, purpose, now);
    if (!claim) return;
    try {
      await sendEmail({ to: claim.customer.email, name: claim.customer.name, locale,
        purpose: purpose === 'VERIFY_EMAIL' ? 'verify-email' : 'reset-password', token: claim.token,
        idempotencyKey: `web-customer-${claim.id}` });
    } catch {
      // HTTP acceptance intentionally does not reveal account existence through
      // a mail outage. The UI describes acceptance, not confirmed delivery.
      logger.warn('Web müşteri e-postası gönderilemedi', { operation: purpose });
      try { await releaseCustomerToken(database(), claim); }
      catch { logger.warn('Web müşteri e-posta denemesi geri alınamadı', { operation: purpose }); }
    }
  }

  router.post('/auth/register', async (req, res) => {
    const input = customerRegisterInput.parse(req.body);
    const { delivery } = configureMail();
    emailLimiter(input.email, 'VERIFY_EMAIL', res);
    const customer = await registerCustomer(database(), input);
    await deliver(customer.id, 'VERIFY_EMAIL', input.locale);
    res.status(202).json({ ok: true, delivery });
  });
  router.post('/auth/resend-verification', async (req, res) => {
    const input = customerEmailInput.parse(req.body);
    const { delivery } = configureMail();
    emailLimiter(input.email, 'VERIFY_EMAIL', res);
    const customer = await database().webCustomer.findUnique({ where: { email: input.email }, select: { id: true } });
    await deliver(customer?.id, 'VERIFY_EMAIL', input.locale);
    res.status(202).json({ ok: true, delivery });
  });
  router.post('/auth/forgot-password', async (req, res) => {
    const input = customerEmailInput.parse(req.body);
    const { delivery } = configureMail();
    emailLimiter(input.email, 'RESET_PASSWORD', res);
    const customer = await database().webCustomer.findUnique({ where: { email: input.email }, select: { id: true } });
    await deliver(customer?.id, 'RESET_PASSWORD', input.locale);
    res.status(202).json({ ok: true, delivery });
  });
  router.post('/auth/verify-email', async (req, res) => {
    const input = customerVerifyInput.parse(req.body);
    await verifyCustomerEmail(database(), input.token, input.password, now);
    res.json({ ok: true });
  });
  router.post('/auth/reset-password', async (req, res) => {
    const input = customerResetInput.parse(req.body);
    await resetCustomerPassword(database(), input.token, input.password, now);
    res.json({ ok: true });
  });
  router.post('/auth/login', async (req, res) => {
    const input = customerLoginInput.parse(req.body);
    const finish = loginLimiter.beginAccount(input.email);
    try {
      const result = await customerLogin(database(), input.email, input.password, now);
      finish('success');
      res.json(result);
    } catch (error) {
      // An unverified but correct password is not a failed credential attempt.
      finish(error instanceof AppError && error.status === 401 ? 'failure' : 'unavailable');
      throw error;
    }
  });
  router.get('/auth/session', requireWebCustomer(database, now), (_req, res) => { res.json({ customer: res.locals.webCustomer }); });
  router.post('/auth/logout', requireWebCustomer(database, now), async (req, res) => {
    await database().webCustomerSession.deleteMany({ where: { tokenHash: hashCustomerSession(customerSessionToken(req)) } });
    res.status(204).end();
  });
  const authErrors: ErrorRequestHandler = (error, _req, res, next) => {
    if (error instanceof CustomerAuthError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error instanceof CustomerMailConfigurationError) {
      res.status(503).json({ error: { code: 'WEB_EMAIL_UNAVAILABLE', message: 'E-posta işlemleri şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.' } }); return;
    }
    next(error);
  };
  router.use(authErrors);
  return router;
}
