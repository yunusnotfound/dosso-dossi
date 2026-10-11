import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

/// Her isteğe kısa bir kimlik verir (log korelasyonu + X-Request-Id
/// yanıt başlığı) ve süre/durum loglar. Query, gövde ve kimlik bilgileri yazılmaz.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomBytes(4).toString('hex');
  res.setHeader('X-Request-Id', requestId);
  const start = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);
    // Express route templates mask path IDs too. Unmatched URLs are never logged.
    const route = typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
    logger.info('request', { requestId, method: req.method, route, status: res.statusCode, durationMs: ms });
  });
  next();
}
