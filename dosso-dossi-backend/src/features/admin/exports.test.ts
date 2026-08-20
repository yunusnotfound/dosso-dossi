import { beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login as customerLogin } from '../../test/helpers.js';
import { hashPassword } from './admin-auth.service.js';

const app = createApp();
const PASSWORD = 'cok-uzun-panel-sifresi';

async function token(): Promise<string> {
  await prisma.adminUser.upsert({
    where: { email: 'export@dossodossi.com' },
    update: {},
    create: {
      email: 'export@dossodossi.com',
      passwordHash: await hashPassword(PASSWORD),
      role: 'SUPER_ADMIN',
    },
  });
  const res = await request(app)
    .post('/admin/auth/login')
    .send({ email: 'export@dossodossi.com', password: PASSWORD });
  return res.body.token as string;
}

/// Yanıt gövdesini gerçek bir çalışma kitabı olarak açar.
/// exceljs kendi Buffer tipini beklediği için gövde ArrayBuffer'a çevrilir.
async function readWorkbook(body: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
  );
  return wb;
}

describe('dışa aktarım', () => {
  let t: string;

  beforeEach(async () => {
    t = await token();
    const customer = await customerLogin(app, '05551112233');
    await request(app)
      .post('/me/wallet/topup')
      .set('Authorization', `Bearer ${customer}`)
      .send({ amount: 2000 });
    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customer}`)
      .send({
        branchId: 'beylikduzu-vadi-loca',
        pickupSlot: 'asap',
        payment: { method: 'dosso_card' },
        items: [
          { productId: 'caffe-latte', quantity: 2, size: 'Orta', milk: '', shot: '' },
        ],
      });
  });

  it('yetkisiz istek dosya indiremez (düz bağlantı çalışmaz)', async () => {
    for (const path of [
      '/admin/finance/ledger.xlsx',
      '/admin/finance/ledger.csv',
      '/admin/orders/export.xlsx',
      '/admin/orders/export.csv',
    ]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });

  it('defter Excel’i: marka şeridi, tip başına sayfa ve özet içerir', async () => {
    const res = await request(app)
      .get('/admin/finance/ledger.xlsx')
      .set('Authorization', `Bearer ${t}`)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('dosso-dossi-cuzdan-defteri');
    // Tarayıcının dosya adını okuyabilmesi CORS'ta bu başlığa bağlı
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');

    const wb = await readWorkbook(res.body as Buffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toContain('Özet');
    expect(names).toContain('Tüm hareketler');
    // İşlem tipi başına ayrı sayfa
    expect(names).toContain('Yükleme');
    expect(names).toContain('Sipariş ödemesi');

    const ws = wb.getWorksheet('Tüm hareketler')!;
    const brand = ws.getCell(1, 1);
    expect(brand.value).toBe('DOSSO DOSSI COFFEE');
    // Altın zemin + koyu kahve yazı (app_colors.dart ile aynı)
    expect(brand.fill).toMatchObject({ fgColor: { argb: 'FFEAC980' } });
    expect(brand.font?.color).toMatchObject({ argb: 'FF6B4E12' });

    const header = ws.getRow(3);
    expect(header.getCell(1).value).toBe('Tarih');
    expect(header.getCell(1).fill).toMatchObject({ fgColor: { argb: 'FF2E211A' } });

    // Başlık satırı sabit ve süzgeç açık
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 });
    expect(ws.autoFilter).toBeTruthy();

    // Para hücreleri ₺ biçiminde
    expect(ws.getRow(4).getCell(6).numFmt).toContain('₺');
  });

  it('sipariş Excel’i: Özet, Siparişler ve Kalemler sayfaları', async () => {
    const res = await request(app)
      .get('/admin/orders/export.xlsx')
      .set('Authorization', `Bearer ${t}`)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    const wb = await readWorkbook(res.body as Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Özet',
      'Siparişler',
      'Kalemler',
    ]);

    const orders = wb.getWorksheet('Siparişler')!;
    expect(orders.getRow(3).getCell(1).value).toBe('Sipariş');
    expect(String(orders.getRow(4).getCell(1).value)).toMatch(/^DD-\d+$/);

    // Kalem sayfası sipariş satırlarını ürün bazında açar
    const items = wb.getWorksheet('Kalemler')!;
    expect(items.getRow(4).getCell(4).value).toBe('Caffe Latte');
    expect(items.getRow(4).getCell(6).value).toBe(2);
  });

  it('sipariş Excel’i ekrandaki filtreyi uygular', async () => {
    const res = await request(app)
      .get('/admin/orders/export.xlsx?status=CANCELLED')
      .set('Authorization', `Bearer ${t}`)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    const wb = await readWorkbook(res.body as Buffer);
    const orders = wb.getWorksheet('Siparişler')!;
    // Başlık satırından sonra veri yok: iptal edilmiş sipariş bulunmuyor
    expect(orders.getRow(4).getCell(1).value).toBeFalsy();
  });

  it('şube müdürü yalnız kendi şubesinin verisini indirir', async () => {
    await prisma.branch.create({
      data: {
        id: 'baska-sube',
        name: 'Başka Şube',
        address: '-',
        city: 'İstanbul',
        lat: 41,
        lng: 29,
        hours: '09:00–22:00',
      },
    });
    await prisma.adminUser.create({
      data: {
        email: 'bm-export@dossodossi.com',
        passwordHash: await hashPassword(PASSWORD),
        role: 'BRANCH_MANAGER',
        branchId: 'baska-sube',
      },
    });
    const login = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'bm-export@dossodossi.com', password: PASSWORD });

    const res = await request(app)
      .get('/admin/orders/export.xlsx')
      .set('Authorization', `Bearer ${login.body.token}`)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    const wb = await readWorkbook(res.body as Buffer);
    const orders = wb.getWorksheet('Siparişler')!;
    // Diğer şubenin siparişi rapora sızmaz
    expect(orders.getRow(4).getCell(1).value).toBeFalsy();
  });
});
