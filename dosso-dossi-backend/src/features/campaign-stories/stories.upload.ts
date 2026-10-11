import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Request } from 'express';
import sharp from 'sharp';
import { AppError, ErrorCodes } from '../../lib/errors.js';
import { auditStandalone } from '../admin/audit.js';

export const MAX_STORY_IMAGE_BYTES = 10 * 1024 * 1024;
export const storyImageTypes = ['image/png', 'image/jpeg', 'image/webp'];

export async function uploadStoryImage(req: Request) {
  if (!storyImageTypes.includes(req.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '')) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 415, 'Yalnız PNG, JPEG veya WebP görsel yükleyin');
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > MAX_STORY_IMAGE_BYTES) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Görsel boş olamaz ve 10 MB sınırını aşamaz');
  }
  let encoded: Buffer;
  try {
    const image = sharp(req.body, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) {
      throw new Error('Unsupported image');
    }
    encoded = await image.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  } catch {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Görsel okunamadı; geçerli, tek kareli bir PNG, JPEG veya WebP seçin');
  }
  const hash = createHash('sha256').update(encoded).digest('hex');
  const directory = path.resolve(process.cwd(), 'uploads/stories');
  const filename = `${hash}.webp`;
  const imageUrl = `/media/stories/${filename}`;
  await mkdir(directory, { recursive: true });
  // Content-addressed writes cannot replace another story's different image.
  try {
    await writeFile(path.join(directory, filename), encoded, { flag: 'wx' });
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && err.code === 'EEXIST')) throw err;
  }
  await auditStandalone(req, {
    entity: 'CampaignStory', entityId: hash, action: 'story.image.upload',
    after: { imageUrl, bytes: encoded.length },
  });
  return { imageUrl };
}
