import { z } from 'zod';

export const builtInStoryActions = ['kahve-ictikce', 'yukle-kazan'] as const;

/** Uploaded paths are local to /media; external image URLs are never fetched by the server. */
export function isStoryImageUrl(value: string): boolean {
  if (!value) return true;
  if (/[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  if (value.startsWith('/')) {
    // No URL escaping, query strings, dot segments or alternate origins in local media paths.
    return /^\/media\/(?:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value);
  }
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return false;
    // Reject traversal spellings before the URL parser normalizes them.
    const unescaped = decodeURIComponent(value);
    return !/(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(unescaped) && !unescaped.includes('\\');
  } catch {
    return false;
  }
}

const optionalDate = z.iso.datetime({ offset: true }).nullable().optional().default(null);

export const storySchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400).default(''),
  imageUrl: z.string().trim().max(2048).refine(isStoryImageUrl, 'Görsel adresi http(s) veya /media/ yolu olmalı').default(''),
  action: z.enum(['none', 'kahve-ictikce', 'yukle-kazan', 'online-magaza', 'siparis']).default('none'),
  actionLabel: z.string().trim().max(40).default(''),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  startsAt: optionalDate,
  endsAt: optionalDate,
}).strict().superRefine((value, ctx) => {
  if (!value.imageUrl && !builtInStoryActions.some((action) => action === value.action)) {
    ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'Bu hikâye için görsel yükleyin' });
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Bitiş tarihi başlangıçtan sonra olmalı' });
  }
});

export type StoryInput = z.infer<typeof storySchema>;
