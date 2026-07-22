import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { login } from '../../test/helpers.js';

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
  it('bakiye hediyesi göndereni borçlandırır, kayıtsız alıcı için PENDING kalır', async () => {
    const token = await senderToken(500);
    const res = await request(app)
      .post('/gifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientPhone: RECIPIENT, type: 'balance', amount: 100, note: 'Afiyet' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.label).toBe('100 ₺ bakiye');

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
