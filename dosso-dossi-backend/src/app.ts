import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { AppError, ErrorCodes } from './lib/errors.js';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use((_req, _res, next) => {
    next(new AppError(ErrorCodes.NOT_FOUND, 404, 'Endpoint bulunamadı'));
  });
  app.use(errorHandler);
  return app;
}
