import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import type { PrismaClient } from '@dosso-dossi/web-prisma';
import { AppError, ErrorCodes } from '../../lib/errors.js';

export const defaultWebMediaRoot = (): string => path.resolve(process.cwd(), 'uploads/web-catalog');
export async function saveWebMedia(database: PrismaClient, originalName: string, input: Buffer, mimeType: string, root = defaultWebMediaRoot()) {
  if (!input.length || input.length > 5 * 1024 * 1024) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Görsel en fazla 5 MB olabilir.');
  let output: { data: Buffer; info: OutputInfo };
  try {
    const source = sharp(input, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await source.metadata();
    const types = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    if (!metadata.format || !(metadata.format in types) || types[metadata.format as keyof typeof types] !== mimeType || (metadata.pages ?? 1) > 1) throw new Error('format');
    output = await source.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  } catch { throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Geçerli, tek kareli JPG, PNG veya WebP görseli yükleyin.'); }
  const filename = `${randomUUID()}.webp`;
  await fs.mkdir(root, { recursive: true });
  const target = path.join(root, filename);
  await fs.writeFile(target, output.data, { flag: 'wx', mode: 0o644 });
  try {
    const media = await database.webMedia.create({ data: { filename, originalName: path.basename(originalName).slice(0, 180), mimeType: 'image/webp', bytes: output.info.size, width: output.info.width, height: output.info.height } });
    return { id: media.id, url: `/web/media/${filename}` };
  } catch (error) { await fs.unlink(target).catch(() => undefined); throw error; }
}
