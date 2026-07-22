import { Router } from 'express';
import { logger } from '../../lib/logger.js';

/// Kerzz POS webhook stub'ları — sunucu↔sunucu köprüsü sonraki fazda.
/// Detay ve açık sorular: docs/KERZZ_POS_ENTEGRASYON.md
export const kerzzWebhooksRouter = Router();

kerzzWebhooksRouter.post('/sale', (req, res) => {
  logger.info('[Kerzz webhook stub] sale', { body: req.body });
  res.json({ ok: true });
});

kerzzWebhooksRouter.post('/order-status', (req, res) => {
  logger.info('[Kerzz webhook stub] order-status', { body: req.body });
  res.json({ ok: true });
});
