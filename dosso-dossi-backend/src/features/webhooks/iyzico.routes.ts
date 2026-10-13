import express, { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { makeRateLimiter } from '../../middleware/rate-limit.js';
import { verifyIyzicoWebhook } from '../wallet/payments/iyzico-payment-provider.js';
import { getPaymentConfiguration, reconcileTopUp } from '../wallet/payments/topup.service.js';

export const iyzicoWebhooksRouter = Router();
iyzicoWebhooksRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const tokenSchema = z.object({ token: z.string().min(1).max(256) });
const callbackLimiter = makeRateLimiter({ windowMs: 60_000, max: 60 });

// A browser redirect is never proof of payment. Only its token is used to retrieve.
iyzicoWebhooksRouter.post('/callback', callbackLimiter, express.urlencoded({ extended: false, limit: '8kb' }), async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    const intent = await prisma.paymentIntent.findFirst({ where: { provider: 'iyzico', providerRef: token } });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');
    try { await reconcileTopUp(intent.id, token); } catch { /* app polling/background worker will retry */ }
    const current = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
    const message = current.status === 'SUCCEEDED'
      ? 'Ödemeniz doğrulandı. Bakiyeniz uygulamada güncellendi.'
      : current.status === 'FAILED'
        ? 'Ödemeniz tamamlanmadı. Sonucu uygulamadan kontrol edebilirsiniz.'
        : 'Ödeme sonucu kontrol ediliyor. Sonucu uygulamaya dönerek takip edebilirsiniz.';
    // No token/amount/customer data or caller-controlled redirect is reflected in this page.
    res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dosso Dossi · Ödeme</title></head><body><main><h1>Dosso Dossi Coffee</h1><p>${message}</p><p>Bu pencereyi kapatıp Dosso Dossi uygulamasına dönebilirsiniz.</p></main></body></html>`);
  } catch (error) { next(error); }
});

const notificationSchema = z.object({
  iyziEventType: z.enum([
    'CHECKOUT_FORM_AUTH', 'BANK_TRANSFER_AUTH', 'BKM_AUTH', 'BALANCE',
    'CONTACTLESS_AUTH', 'CREDIT_PAYMENT_AUTH', 'CREDIT_PAYMENT_PENDING',
    'CREDIT_PAYMENT_INIT', 'PWI_TKN_FUND', 'PWI_TKN_AUTH', 'PWI_TKN_THREEDS_AUTH',
  ]),
  iyziPaymentId: z.union([z.string().regex(/^\d+$/).max(80), z.number().int().nonnegative().safe()]),
  token: z.string().min(1).max(256),
  paymentConversationId: z.string().min(1).max(128),
  status: z.string().min(1).max(80),
});

iyzicoWebhooksRouter.post('/notification', async (req, res, next) => {
  try {
    if (env.PAYMENT_PROVIDER !== 'iyzico' || !getPaymentConfiguration().enabled ||
      !verifyIyzicoWebhook(req.body, req.headers['x-iyz-signature-v3'], env.IYZICO_SECRET_KEY)) throw AppError.invalidSignature();
    const body = notificationSchema.parse(req.body);
    const intent = await prisma.paymentIntent.findFirst({ where: { id: body.paymentConversationId, provider: 'iyzico' } });
    if (!intent) throw AppError.notFound('Ödeme bulunamadı');
    // A different lifecycle event may contain the same token, so do not cache the
    // first notification forever. The unique intent/ledger transaction dedupes credit.
    await reconcileTopUp(intent.id, body.token, true);
    res.json({ ok: true });
  } catch (error) { next(error); }
});
