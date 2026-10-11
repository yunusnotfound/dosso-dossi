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
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
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
  // Express/body-parser errors are client failures, never retryable 500s.
  if (err instanceof Error && 'type' in err) {
    const types: Record<string, [number, string, string]> = {
      'entity.parse.failed': [400, 'VALIDATION_ERROR', 'Geçerli bir JSON gövdesi gönderin'],
      'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'İstek gövdesi çok büyük'],
      'encoding.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'İstek kodlaması desteklenmiyor'],
      'charset.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Karakter kodlaması desteklenmiyor'],
      'request.aborted': [400, 'VALIDATION_ERROR', 'İstek tamamlanamadı'],
      'request.size.invalid': [400, 'VALIDATION_ERROR', 'İstek boyutu geçersiz'],
    };
    const parserError = typeof err.type === 'string' ? types[err.type] : undefined;
    if (parserError) {
      const [status, code, message] = parserError;
      res.status(status).json({ error: { code, message } });
      return;
    }
  }
  logger.error('Beklenmeyen hata', {
    requestId: res.getHeader('X-Request-Id'),
    // Error messages/stacks can contain request bodies, tokens or personal data.
    errorType: err instanceof Error && ['Error', 'TypeError', 'SyntaxError', 'RangeError', 'AggregateError'].includes(err.name)
      ? err.name : 'UnknownError',
  });
  res.status(500).json({
    error: { code: ErrorCodes.INTERNAL, message: 'Beklenmeyen bir hata oluştu' },
  });
}
