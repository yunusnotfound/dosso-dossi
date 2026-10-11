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
  maxKeys?: number;
}) {
  const buckets = new Map<string, Bucket>();
  const maxKeys = opts.maxKeys ?? 10_000;
  let nextSweepAt = 0;
  const keyFn = opts.keyFn ?? ((req: Request) => req.userId ?? req.ip ?? 'anon');

  const middleware = (req: Request, _res: Response, next: NextFunction): void => {
    if (env.NODE_ENV === 'test' && !opts.force) {
      next();
      return;
    }
    const now = Date.now();
    if (now >= nextSweepAt) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      nextSweepAt = now + Math.min(opts.windowMs, 1000);
    }
    const key = keyFn(req);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= maxKeys) { next(AppError.rateLimited()); return; }
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

  };
  middleware.resetAll = () => { buckets.clear(); nextSweepAt = 0; };
  middleware.bucketCount = () => buckets.size;
  return middleware;
}
