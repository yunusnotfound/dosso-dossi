import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

/// Her isteğe kısa bir kimlik verir (log korelasyonu + X-Request-Id
/// yanıt başlığı) ve süre/durum loglar. Oturumlu isteklerde userId de
/// yazılır — webhook/idempotency akışlarını izlemeyi mümkün kılar.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomBytes(4).toString('hex');
  res.setHeader('X-Request-Id', requestId);
  const start = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);
    const user = req.userId ? ` user=${req.userId}` : '';
    logger.info(
      `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms${user}`,
    );
  });
  next();
}
