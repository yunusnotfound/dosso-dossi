import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { makeRateLimiter } from './rate-limit.js';

function call(limiter: ReturnType<typeof makeRateLimiter>): unknown {
  let captured: unknown;
  const next: NextFunction = (err?: unknown) => {
    captured = err;
  };
  limiter({ userId: 'u1' } as Request, {} as Response, next);
  return captured;
}

describe('makeRateLimiter', () => {
  it('pencere içinde limiti aşan istek RATE_LIMITED alır', () => {
    const limiter = makeRateLimiter({ windowMs: 60_000, max: 3, force: true });
    expect(call(limiter)).toBeUndefined();
    expect(call(limiter)).toBeUndefined();
    expect(call(limiter)).toBeUndefined();
    const err = call(limiter);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('RATE_LIMITED');
  });

  it('pencere dolunca sayaç sıfırlanır', () => {
    vi.useFakeTimers();
    try {
      const limiter = makeRateLimiter({ windowMs: 1_000, max: 1, force: true });
      expect(call(limiter)).toBeUndefined();
      expect(call(limiter)).toBeInstanceOf(AppError);
      vi.advanceTimersByTime(1_100);
      expect(call(limiter)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('test ortamında force olmadan devre dışıdır', () => {
    const limiter = makeRateLimiter({ windowMs: 60_000, max: 1 });
    expect(call(limiter)).toBeUndefined();
    expect(call(limiter)).toBeUndefined();
    expect(call(limiter)).toBeUndefined();
  });
});
