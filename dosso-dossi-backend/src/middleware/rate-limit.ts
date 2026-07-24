import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/// Bellek içi sabit pencereli rate limiter. Tek instance için yeterli;
/// çoklu instance'a geçilirse Redis tabanlıyla değiştirilecek.
export function makeRateLimiter(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  /// Test ortamında limiter varsayılan kapalıdır; birim testte açmak için.
  force?: boolean;
}) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn ?? ((req: Request) => req.userId ?? req.ip ?? 'anon');

  const middleware = (req: Request, _res: Response, next: NextFunction): void => {
    if (env.NODE_ENV === 'test' && !opts.force) {
      next();
      return;
    }
    const now = Date.now();
    const key = keyFn(req);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    bucket.count++;
    if (bucket.count > opts.max) {
      next(AppError.rateLimited());
      return;
    }
    next();

    // Sınırsız büyümesin: pencere sayısı arttıkça süresi geçenleri temizle
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }
  };
  middleware.resetAll = () => buckets.clear();
  return middleware;
}
