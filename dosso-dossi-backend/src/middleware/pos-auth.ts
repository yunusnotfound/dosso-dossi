import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

// express.json'un verify callback'i http.IncomingMessage alır;
// Express Request de ondan türediği için bildirim burada yapılır.
declare module 'node:http' {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

const TOLERANCE_SECONDS = 300;

type SecretName = 'POS_WEBHOOK_SECRET' | 'PAYMENT_WEBHOOK_SECRET';

/// POS köprüsü / ödeme webhook'ları için HMAC-SHA256 imza doğrulaması.
/// Başlık: X-Dosso-Signature: t=<unixSaniye>,v1=<hex hmac(secret, "t.rawBody")>
/// Timestamp imzanın içinde olduğu için replay koruması da sağlar.
export function posAuth(secretName: SecretName) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const header = req.headers['x-dosso-signature'];
      if (typeof header !== 'string') throw AppError.invalidSignature();

      const parts = Object.fromEntries(
        header.split(',').map((p) => p.split('=') as [string, string]),
      );
      const timestamp = Number(parts['t']);
      const signature = parts['v1'];
      if (!Number.isFinite(timestamp) || !signature) {
        throw AppError.invalidSignature();
      }
      if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
        throw AppError.invalidSignature('İmza zaman damgası çok eski');
      }

      const expected = signPayload(
        env[secretName],
        timestamp,
        req.rawBody ?? Buffer.from(''),
      );
      const provided = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      if (
        provided.length !== expectedBuf.length ||
        !timingSafeEqual(provided, expectedBuf)
      ) {
        throw AppError.invalidSignature();
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/// Simülatör ve testlerin de kullandığı imzalama yardımcıları.
export function signPayload(
  secret: string,
  timestamp: number,
  rawBody: Buffer | string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

export function buildSignatureHeader(secret: string, body: string): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${signPayload(secret, t, body)}`;
}
