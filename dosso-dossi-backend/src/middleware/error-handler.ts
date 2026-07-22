import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    res
      .status(400)
      .json({ error: { code: ErrorCodes.VALIDATION_ERROR, message } });
    return;
  }
  logger.error('Beklenmeyen hata', {
    error: err instanceof Error ? err.stack : String(err),
  });
  res.status(500).json({
    error: { code: ErrorCodes.INTERNAL, message: 'Beklenmeyen bir hata oluştu' },
  });
}
