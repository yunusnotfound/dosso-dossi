import { randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signAdminToken } from '../../middleware/admin-auth.js';
import { login } from '../../test/helpers.js';
import { publicStories } from './stories.service.js';

const app = createApp();
const uploads = new Set<string>();
let adminToken: string;
const baseStory = { title: 'Yeni tatlar', imageUrl: 'https://example.com/story.webp', action: 'siparis', actionLabel: 'Sipariş ver' };
const auth = () => ({ Authorization: `Bearer ${adminToken}` });

beforeEach(async () => {
  const admin = await prisma.adminUser.create({ data: { email: 'story-admin@test.local', role: 'SUPER_ADMIN', passwordHash: 'unused' } });
  adminToken = signAdminToken(admin.id);
  await prisma.campaign.createMany({ data: [
    { id: 'kahve-ictikce', title: 'Kahve Kazan', badge: '', description: '', style: 'orange' },
    { id: 'yukle-kazan', title: 'Yükle Kazan', badge: '', description: '', style: 'dark' },
  ] });
});

afterAll(async () => { await Promise.all([...uploads].map((file) => unlink(file))); });

async function revision(): Promise<Record<string, string>> {
  const response = await request(app).get('/sync/revisions');
  expect(response.status).toBe(200);
  return response.body as Record<string, string>;
}

async function createStory(data = baseStory) {
  const response = await request(app).post('/admin/campaign-stories').set(auth()).send(data);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body as Record<string, any>;
}

describe('campaign stories publication', () => {
  it('serves the same story array to guests and members without exposing admin data', async () => {
    const created = await createStory();
    const guest = await request(app).get('/campaign-stories');
    const member = await request(app).get('/campaign-stories').auth(await login(app, '05551112233'), { type: 'bearer' });
    expect(guest.status).toBe(200);
    expect(guest.headers['cache-control']).toBe('no-store');
    expect(member.body).toEqual(guest.body);
    expect(guest.body).toHaveLength(1);
    expect(guest.body[0]).toMatchObject({ id: created.id, title: baseStory.title, imageUrl: baseStory.imageUrl, action: 'siparis' });
    expect(Number.isNaN(Date.parse(guest.body[0].updatedAt))).toBe(false);
    expect(guest.body[0]).not.toHaveProperty('adminId');
  });

  it('orders deterministically and excludes inactive, future and expired publications', async () => {
    const now = new Date('2026-10-02T12:00:00.000Z');
    const stamp = new Date('2026-10-01T12:00:00.000Z');
    await prisma.campaignStory.createMany({ data: [
      { id: 'second', ...baseStory, sortOrder: 3, createdAt: stamp },
      { id: 'z-tie', ...baseStory, sortOrder: 1, createdAt: stamp },
      { id: 'a-tie', ...baseStory, sortOrder: 1, createdAt: stamp, startsAt: now },
      { id: 'hidden', ...baseStory, isActive: false },
      { id: 'future', ...baseStory, startsAt: new Date(now.getTime() + 1) },
      { id: 'expired', ...baseStory, endsAt: now },
    ] });
    expect((await publicStories(now)).map((story) => story.id)).toEqual(['a-tie', 'z-tie', 'second']);
    // Time boundaries are evaluated without requiring a new audit or mutation.
    expect((await publicStories(new Date(now.getTime() + 1))).map((story) => story.id)).toEqual(['future', 'a-tie', 'z-tie', 'second']);
  });

  it('uses live existing built-in campaigns and hides a paused or missing underlying campaign', async () => {
    const created = await request(app).post('/admin/campaign-stories').set(auth()).send({ title: 'Kahve Kazan', action: 'kahve-ictikce' });
    expect(created.status).toBe(200);
    expect(created.body.imageUrl).toBe('');
    expect((await request(app).get('/campaign-stories')).body).toHaveLength(1);
    await prisma.campaign.update({ where: { id: 'kahve-ictikce' }, data: { isActive: false } });
    expect((await request(app).get('/campaign-stories')).body).toEqual([]);
    expect((await request(app).get('/admin/campaign-stories').set(auth())).body).toHaveLength(1);
    await prisma.campaign.delete({ where: { id: 'kahve-ictikce' } });
    expect((await request(app).get('/campaign-stories')).body).toEqual([]);
    const missing = await request(app).post('/admin/campaign-stories').set(auth()).send({ title: 'Kahve Kazan', action: 'kahve-ictikce' });
    expect(missing.status).toBe(404);
  });

  it('audits create, edit and delete atomically and changes only campaigns sync revision', async () => {
    const initial = await revision();
    const created = await createStory();
    const afterCreate = await revision();
    expect(afterCreate.campaigns).not.toBe(initial.campaigns);
    for (const domain of Object.keys(initial).filter((key) => key !== 'campaigns')) expect(afterCreate[domain]).toBe(initial[domain]);
    const update = await request(app).post('/admin/campaign-stories').set(auth()).send({ ...baseStory, id: created.id, title: 'Yeni başlık', isActive: false });
    expect(update.status).toBe(200);
    expect((await revision()).campaigns).not.toBe(afterCreate.campaigns);
    expect((await request(app).get('/campaign-stories')).body).toEqual([]);
    const afterUpdate = await revision();
    const deleted = await request(app).delete(`/admin/campaign-stories/${created.id}`).set(auth());
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ ok: true });
    expect((await revision()).campaigns).not.toBe(afterUpdate.campaigns);
    const events = await prisma.auditLog.findMany({ where: { entity: 'CampaignStory', entityId: created.id }, orderBy: { createdAt: 'asc' } });
    expect(events.map((event) => event.action)).toEqual(['story.create', 'story.update', 'story.delete']);
    expect(events[1]?.before).toMatchObject({ title: baseStory.title });
    expect(events[1]?.after).toMatchObject({ title: 'Yeni başlık' });
    expect((await request(app).delete(`/admin/campaign-stories/${created.id}`).set(auth())).status).toBe(404);
  });

  it('rejects an unknown update id without silently publishing a new story', async () => {
    expect((await request(app).post('/admin/campaign-stories').set(auth()).send({ ...baseStory, id: 'missing-story' })).status).toBe(404);
    expect(await prisma.campaignStory.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'CampaignStory' } })).toBe(0);
  });

  it.each(['VIEWER', 'BRANCH_MANAGER'] as const)('lets %s read but denies writing, deleting and uploading', async (role) => {
    const admin = await prisma.adminUser.create({ data: { email: `${role}@test.local`, role, passwordHash: 'unused', branchId: role === 'BRANCH_MANAGER' ? 'beylikduzu-vadi-loca' : null } });
    const headers = { Authorization: `Bearer ${signAdminToken(admin.id)}` };
    const created = await createStory();
    expect((await request(app).get('/admin/campaign-stories').set(headers)).status).toBe(200);
    expect((await request(app).post('/admin/campaign-stories').set(headers).send(baseStory)).status).toBe(403);
    expect((await request(app).delete(`/admin/campaign-stories/${created.id}`).set(headers)).status).toBe(403);
    expect((await request(app).post('/admin/campaign-stories/image').set(headers).set('Content-Type', 'image/png').send(Buffer.from('bad'))).status).toBe(403);
  });

  it('allows manager writes while rejecting unauthenticated and customer admin access', async () => {
    const admin = await prisma.adminUser.create({ data: { email: 'manager@test.local', role: 'MANAGER', passwordHash: 'unused' } });
    expect((await request(app).post('/admin/campaign-stories').auth(signAdminToken(admin.id), { type: 'bearer' }).send(baseStory)).status).toBe(200);
    expect((await request(app).get('/admin/campaign-stories')).status).toBe(401);
    expect((await request(app).post('/admin/campaign-stories').send(baseStory)).status).toBe(401);
    const token = await login(app, '05551112233');
    expect((await request(app).get('/admin/campaign-stories').auth(token, { type: 'bearer' })).status).toBe(401);
  });

  it.each([
    { imageUrl: 'javascript:alert(1)' }, { imageUrl: 'file:///etc/passwd' }, { imageUrl: 'data:image/png;base64,aa' },
    { imageUrl: '//evil.example.com/a.png' }, { imageUrl: '/media/../secret' }, { imageUrl: '/media/%2e%2e/secret' },
    { imageUrl: '/media/stories\\bad.png' }, { imageUrl: 'https://example.com/../secret' }, { imageUrl: 'https://user:pass@example.com/a.png' },
    { imageUrl: '' }, { title: '' }, { title: 'a'.repeat(61) }, { description: 'a'.repeat(401) },
    { action: 'https://evil.example.com' }, { actionLabel: 'a'.repeat(41) }, { sortOrder: -1 }, { sortOrder: 1000 },
    { startsAt: 'not-a-date' }, { startsAt: '2026-10-02T12:00:00Z', endsAt: '2026-10-02T12:00:00Z' },
  ])('rejects invalid publication %# without audit side effects', async (invalid) => {
    expect((await request(app).post('/admin/campaign-stories').set(auth()).send({ ...baseStory, ...invalid })).status).toBe(400);
    expect(await prisma.campaignStory.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'CampaignStory' } })).toBe(0);
  });

  it('accepts encoded normal remote paths and constrained local media paths', async () => {
    for (const imageUrl of ['/media/stories/cafe-1.webp', 'https://example.com/kahve%20afisi.png', 'http://localhost:3000/media/cup.webp']) {
      const result = await request(app).post('/admin/campaign-stories').set(auth()).send({ ...baseStory, imageUrl });
      expect(result.status).toBe(200);
    }
  });
});

describe('campaign story image upload', () => {
  it('reencodes real image bytes, serves safe immutable WebP and audits the upload', async () => {
    const source = await sharp(randomBytes(3 * 20 * 20), { raw: { width: 20, height: 20, channels: 3 } }).png().toBuffer();
    const response = await request(app).post('/admin/campaign-stories/image').set(auth()).set('Content-Type', 'image/png').send(source);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const imageUrl = response.body.imageUrl as string;
    expect(imageUrl).toMatch(/^\/media\/stories\/[a-f0-9]{64}\.webp$/);
    uploads.add(path.resolve(process.cwd(), 'uploads', imageUrl.slice('/media/'.length)));
    const duplicate = await request(app).post('/admin/campaign-stories/image').set(auth()).set('Content-Type', 'image/png').send(source);
    expect(duplicate.body.imageUrl).toBe(imageUrl);
    const image = await request(app).get(imageUrl);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(image.headers['cache-control']).toContain('immutable');
    expect((await sharp(image.body as Buffer).metadata()).format).toBe('webp');
    expect(await prisma.auditLog.count({ where: { entity: 'CampaignStory', action: 'story.image.upload' } })).toBe(2);
    const created = await request(app).post('/admin/campaign-stories').set(auth()).send({ ...baseStory, imageUrl });
    expect(created.status).toBe(200);
  });

  it('rejects incorrect formats, corrupted bytes, empty images and images over 10 MB', async () => {
    const call = (type: string, body: Buffer) => request(app).post('/admin/campaign-stories/image').set(auth()).set('Content-Type', type).send(body);
    expect((await call('image/svg+xml', Buffer.from('<svg/>'))).status).toBe(415);
    expect((await call('image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'))).status).toBe(400);
    expect((await call('image/png', Buffer.from('invalid'))).status).toBe(400);
    expect((await call('image/png', Buffer.alloc(0))).status).toBe(400);
    expect((await call('image/png', Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    expect(await prisma.auditLog.count({ where: { entity: 'CampaignStory' } })).toBe(0);
  });

  it('rejects decompression-sized images before encoding them', async () => {
    const oversized = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: 'white' } }).png().toBuffer();
    expect(oversized.length).toBeLessThan(10 * 1024 * 1024);
    const response = await request(app).post('/admin/campaign-stories/image').set(auth()).set('Content-Type', 'image/png').send(oversized);
    expect(response.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { entity: 'CampaignStory' } })).toBe(0);
  });
});
