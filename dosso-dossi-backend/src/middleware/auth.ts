import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId: string;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      next(AppError.unauthorized());
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    next(AppError.unauthorized('Oturum süresi doldu, yeniden giriş yapın'));
  }
}
