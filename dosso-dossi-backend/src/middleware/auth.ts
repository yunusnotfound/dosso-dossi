import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId: string;
  }
}

export function signToken(userId: string, tokenVersion = 0): string {
  return jwt.sign({ sub: userId, v: tokenVersion }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { next(AppError.unauthorized()); return; }
  let payload: jwt.JwtPayload;
  try {
    const parsed = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof parsed === 'string' || typeof parsed.sub !== 'string' ||
        (parsed.v !== undefined && !Number.isInteger(parsed.v))) {
      next(AppError.unauthorized()); return;
    }
    payload = parsed;
  } catch { next(AppError.unauthorized('Oturum süresi doldu, yeniden giriş yapın')); return; }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub! }, select: { id: true, tokenVersion: true, isBlocked: true },
    });
    // Önceki sürümün token'ları version=0 hesaplarda geçerli kalır.
    if (!user || user.tokenVersion !== (payload.v ?? 0)) { next(AppError.unauthorized()); return; }
    if (user.isBlocked && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next(AppError.accountBlocked()); return;
    }
    req.userId = user.id;
    next();
  } catch (error) { next(error); }
}
