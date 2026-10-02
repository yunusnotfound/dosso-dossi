export type StoryAction = 'none' | 'kahve-ictikce' | 'yukle-kazan' | 'online-magaza' | 'siparis';
export interface CampaignStory {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  action: StoryAction;
  actionLabel: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export type StoryInput = Omit<CampaignStory, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export const STORY_ACTIONS: Record<StoryAction, string> = {
  none: 'Yalnız hikâyeyi göster',
  'kahve-ictikce': '5 damga, 1 ikram',
  'yukle-kazan': 'Yükle Kazan',
  'online-magaza': 'Online mağaza',
  siparis: 'Sipariş ver',
};
export const EMPTY_STORY: StoryInput = {
  title: '', description: '', imageUrl: '', action: 'none', actionLabel: 'Keşfet',
  sortOrder: 0, isActive: true, startsAt: null, endsAt: null,
};
export function storyInput(story: CampaignStory): StoryInput {
  const { id, title, description, imageUrl, action, actionLabel, sortOrder, isActive, startsAt, endsAt } = story;
  return { id, title, description, imageUrl, action, actionLabel, sortOrder, isActive, startsAt, endsAt };
}
export function hasBuiltInArtwork(action: StoryAction): boolean {
  return action === 'kahve-ictikce' || action === 'yukle-kazan';
}
export function validStoryImage(value: string): boolean {
  if (!value || value.length > 2048 || /[\s\\]/u.test(value) || [...value].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)) return false;
  if (value.startsWith('/')) return /^\/media\/(?:[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(value);
  try {
    const url = new URL(value);
    const unescaped = decodeURIComponent(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password &&
      !/(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(unescaped) && !unescaped.includes('\\');
  } catch { return false; }
}
export function storyError(story: StoryInput): string {
  if (!story.title.trim()) return 'Hikâye başlığını yazın.';
  if (story.title.trim().length > 60 || story.description.length > 400 || story.actionLabel.length > 40) return 'Başlık, açıklama veya düğme metni izin verilen uzunluğu aşıyor.';
  if (story.imageUrl && !validStoryImage(story.imageUrl.trim())) return 'Geçerli bir görsel adresi girin veya dosya yükleyin.';
  if (!story.imageUrl.trim() && !hasBuiltInArtwork(story.action)) return 'Bu hikâye için bir görsel yükleyin.';
  if (!Number.isInteger(story.sortOrder) || story.sortOrder < 0 || story.sortOrder > 999) return 'Gösterim sırası 0–999 arasında tam sayı olmalı.';
  if (story.action !== 'none' && !story.actionLabel.trim()) return 'Düğme metnini yazın.';
  if ((story.startsAt && !Number.isFinite(Date.parse(story.startsAt))) || (story.endsAt && !Number.isFinite(Date.parse(story.endsAt)))) return 'Geçerli bir yayın tarihi seçin.';
  if (story.startsAt && story.endsAt && Date.parse(story.endsAt) <= Date.parse(story.startsAt)) return 'Bitiş, başlangıç tarihinden sonra olmalı.';
  return '';
}
export function storyStatus(story: StoryInput, now = Date.now()) {
  if (!story.isActive) return { label: 'Taslak', tone: 'neutral' as const };
  if (story.endsAt && Date.parse(story.endsAt) <= now) return { label: 'Süresi doldu', tone: 'neutral' as const };
  if (story.startsAt && Date.parse(story.startsAt) > now) return { label: 'Planlandı', tone: 'gold' as const };
  return { label: 'Yayında', tone: 'ok' as const };
}
export function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function isoDateTime(value: string): string | null {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
}
