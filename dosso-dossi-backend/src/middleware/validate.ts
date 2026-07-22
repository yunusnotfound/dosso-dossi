import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/// Gövdeyi şemayla doğrular; parse sonucu req.body'ye yazılır.
/// ZodError error-handler'da VALIDATION_ERROR'a çevrilir.
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
