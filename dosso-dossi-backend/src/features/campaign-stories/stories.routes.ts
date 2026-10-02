import express, { Router } from 'express';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import { storySchema } from './stories.schema.js';
import { adminStories, deleteStory, publicStories, saveStory } from './stories.service.js';
import { MAX_STORY_IMAGE_BYTES, uploadStoryImage } from './stories.upload.js';

export const storiesRouter = Router();
export const adminStoriesRouter = Router();

storiesRouter.get('/', async (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await publicStories()); } catch (err) { next(err); }
});

adminStoriesRouter.get('/', requireAdmin(), async (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await adminStories()); } catch (err) { next(err); }
});

// Authenticate before buffering bytes. Multipart and arbitrary formats are not accepted.
adminStoriesRouter.post('/image', requireAdmin('SUPER_ADMIN', 'MANAGER'), (req, res, next) => {
  express.raw({ type: () => true, limit: MAX_STORY_IMAGE_BYTES })(req, res, (err: unknown) => {
    if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
      next(new AppError(ErrorCodes.VALIDATION_ERROR, 413, 'Görsel en fazla 10 MB olabilir'));
      return;
    }
    next(err);
  });
}, async (req, res, next) => {
  try { res.json(await uploadStoryImage(req)); } catch (err) { next(err); }
});

adminStoriesRouter.post('/', requireAdmin('SUPER_ADMIN', 'MANAGER'), validate(storySchema), async (req, res, next) => {
  try { res.json(await saveStory(req, req.body)); } catch (err) { next(err); }
});

adminStoriesRouter.delete('/:id', requireAdmin('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  try { await deleteStory(req, String(req.params.id)); res.json({ ok: true }); } catch (err) { next(err); }
});
