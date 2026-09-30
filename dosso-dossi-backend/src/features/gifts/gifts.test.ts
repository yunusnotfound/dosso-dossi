import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { smsProvider } from '../../lib/sms/dev-sms-provider.js';
import { login } from '../../test/helpers.js';
import { claimGiftForUser } from './gift-claim.js';

const app = createApp();
const SENDER = '05551112233';
const RECIPIENT = '05559998877';

async function senderToken(balance = 1000): Promise<string> {
  const token = await login(app, SENDER);
  await request(app)
    .post('/me/wallet/topup')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: balance });
  return token;
}

describe('gifts', () => {
  beforeEach(() => {
    vi.spyOn(smsProvider, 'send').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bakiye hediyesi göndereni borçlandırır, kayıtsız alıcı için PENDING kalır', async () => {
    const token = await senderToken(500);
    const res = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: 'Afiyet' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.label).toBe('100 ₺ bakiye');
    expect(res.body).not.toHaveProperty('redeemCode');

    expect(smsProvider.send).toHaveBeenCalledExactlyOnceWith(
      '5559998877',
      `Dosso Dossi'den hediyeniz var: 100 ₺ bakiye. ` +
        `Hediyenizi kullanmak için Dosso Dossi Coffee uygulamasına bu telefon numarasıyla giriş yapın. ` +
        `Hediyeniz hesabınıza eklenir ve yalnızca uygulama üzerinden kullanılabilir.`,
    );

    const senderWallet = await prisma.wallet.findFirstOrThrow();
    expect(Number(senderWallet.balance)).toBe(400);
  });

  it('kayıtsız alıcı giriş yapınca bekleyen hediye hesabına işlenir', async () => {
    const token = await senderToken(500);
    await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: '' });

    const recipientTok = await login(app, RECIPIENT);
    const wallet = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${recipientTok}`);
    expect(wallet.body.balance).toBe(100);

    const gift = await prisma.gift.findFirstOrThrow();
    expect(gift.status).toBe('REDEEMED');
    expect(gift.recipientId).toBeTruthy();
  });

  it('içecek hediyesi kayıtlı alıcıya anında ikram hakkı olarak işlenir', async () => {
    const recipientTok = await login(app, RECIPIENT);
    const token = await senderToken(500);
    const res = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'drink', productId: 'caffe-latte', note: '' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('redeemed');
    expect(res.body.amount).toBe(190);

    const loyalty = await request(app)
      .get('/me/loyalty')
      .set('Authorization', `Bearer ${recipientTok}`);
    expect(loyalty.body.freeDrinks).toBe(1);
    expect(loyalty.body.history[0].title).toBe('Hediye: Caffe Latte');
  });

  it('aynı hediye iki kez claim edilirse yalnız bir kez kredi işlenir', async () => {
    const token = await senderToken(500);
    await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: '' });

    const recipientTok = await login(app, RECIPIENT); // ilk claim burada
    const gift = await prisma.gift.findFirstOrThrow();
    const recipient = await prisma.user.findUniqueOrThrow({
      where: { phone: '5559998877' },
    });

    // Guard'ı doğrudan zorla: zaten REDEEMED hediyeye ikinci claim
    await prisma.$transaction((tx) => claimGiftForUser(tx, gift, recipient.id));

    const wallet = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${recipientTok}`);
    expect(wallet.body.balance).toBe(100); // 200 değil
  });

  it('başka telefon numarasının hesabı hediyeyi alamaz', async () => {
    const token = await senderToken(500);
    await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: '' });

    const otherToken = await login(app, '05557776655');
    const otherUser = await prisma.user.findUniqueOrThrow({
      where: { phone: '5557776655' },
    });
    const gift = await prisma.gift.findFirstOrThrow();
    const alteredGift = { ...gift, recipientPhone: otherUser.phone };
    await expect(
      prisma.$transaction((tx) => claimGiftForUser(tx, alteredGift, otherUser.id)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

    const unchangedGift = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(unchangedGift.status).toBe('PENDING');
    expect(unchangedGift.recipientId).toBeNull();
    const wallet = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(wallet.body.balance).toBe(0);
    expect(await prisma.walletTransaction.count({ where: { type: 'GIFT_RECEIVED' } })).toBe(0);

    const recipientToken = await login(app, RECIPIENT);
    const recipientWallet = await request(app)
      .get('/me/wallet')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(recipientWallet.body.balance).toBe(100);
  });

  it('dondurulan alıcının hediyesi bekler, hesap açıldıktan sonraki girişte işlenir', async () => {
    await login(app, RECIPIENT);
    const recipient = await prisma.user.update({
      where: { phone: '5559998877' },
      data: { isBlocked: true },
    });
    const token = await senderToken(500);
    const sent = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'drink', productId: 'caffe-latte', note: '' });
    expect(sent.status).toBe(201);
    expect(sent.body.status).toBe('pending');

    await login(app, RECIPIENT);
    const pending = await prisma.gift.findFirstOrThrow();
    expect(pending.status).toBe('PENDING');
    expect(pending.recipientId).toBeNull();
    const loyalty = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: recipient.id } });
    expect(loyalty.freeDrinks).toBe(0);

    await prisma.user.update({ where: { id: recipient.id }, data: { isBlocked: false } });
    const recipientToken = await login(app, RECIPIENT);
    const claimed = await request(app)
      .get('/me/loyalty')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(claimed.body.freeDrinks).toBe(1);
    expect(claimed.body.history.filter((event: { title: string }) => event.title === 'Hediye: Caffe Latte')).toHaveLength(1);
  });

  it('hediye işlemleri ve hesap hakları oturum gerektirir', async () => {
    const sent = await request(app)
      .post('/gifts')
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: '' });
    expect(sent.status).toBe(401);
    for (const path of ['/gifts', '/me/wallet', '/me/loyalty']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
    const qr = await request(app).post('/me/wallet/qr-token');
    expect(qr.status).toBe(401);
    const order = await request(app).post('/orders');
    expect(order.status).toBe(401);
    expect(await prisma.gift.count()).toBe(0);
  });

  it('yetersiz bakiyede hediye gönderilemez', async () => {
    const token = await senderToken(50);
    const res = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await prisma.gift.count()).toBe(0);
  });
});
