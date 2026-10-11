import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toMoney } from '../../lib/money.js';
import { serializeAccountRequest } from './account-requests.service.js';

export type ExportSection = 'profile' | 'orders' | 'wallet' | 'gifts' | 'loyalty' | 'requests';
const PAGE_SIZE = 100;
const maskPhone = (phone: string) => phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : '****';
const redactPhones = (value: string) => value.replace(/\+?\d[\d ()-]{8,}\d/g, (match) => maskPhone(match.replace(/\D/g, '')));

/** Explicit allowlists keep authentication secrets and other people's account records out of exports. */
export async function exportUserData(userId: string, section: ExportSection, page = 1) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw AppError.notFound('Kullanıcı bulunamadı');
  const paging = { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 };
  let entries: unknown[];
  switch (section) {
    case 'profile': {
      if (page !== 1) { entries = []; break; }
      const profile = await prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: {
          id: true, phone: true, name: true, email: true, createdAt: true,
          notificationPrefs: { select: { campaigns: true, orderStatus: true, sms: true } },
          wallet: { select: { balance: true, cardLast4: true } },
          loyalty: { select: { stamps: true, target: true, freeDrinks: true } },
        },
      });
      entries = [{ ...profile, wallet: profile.wallet ? { ...profile.wallet, balance: toMoney(profile.wallet.balance) } : null }];
      break;
    }
    case 'orders': {
      const orders = await prisma.order.findMany({
        where: { userId }, ...paging, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          number: true, status: true, createdAt: true, branchId: true, pickupSlot: true,
          subtotal: true, discount: true, freeDrinkDiscount: true, total: true, promoCode: true,
          usedFreeDrink: true, stampsEarned: true,
          items: { select: { productId: true, productName: true, unitPrice: true, quantity: true, size: true, milk: true, shot: true, isFreeDrink: true } },
        },
      });
      entries = orders.map(({ number, ...order }) => ({
        ...order, id: `DD-${number}`, subtotal: toMoney(order.subtotal), discount: toMoney(order.discount),
        freeDrinkDiscount: toMoney(order.freeDrinkDiscount), total: toMoney(order.total),
        items: order.items.map((item) => ({ ...item, unitPrice: toMoney(item.unitPrice) })),
      }));
      break;
    }
    case 'wallet': {
      const rows = await prisma.walletTransaction.findMany({
        where: { wallet: { userId } }, ...paging, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, type: true, amount: true, balanceAfter: true, note: true, createdAt: true },
      });
      entries = rows.map((row) => ({ ...row, amount: toMoney(row.amount), balanceAfter: toMoney(row.balanceAfter), note: redactPhones(row.note) }));
      break;
    }
    case 'gifts': {
      const rows = await prisma.gift.findMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] }, ...paging,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, senderId: true, recipientPhone: true, type: true, label: true, amount: true, note: true, status: true, createdAt: true, redeemedAt: true },
      });
      entries = rows.map(({ senderId, recipientPhone, ...row }) => ({
        ...row, amount: toMoney(row.amount), direction: senderId === userId ? 'sent' : 'received',
        ...(senderId === userId ? { recipientPhoneMasked: maskPhone(recipientPhone) } : {}),
      }));
      break;
    }
    case 'loyalty':
      entries = await prisma.loyaltyEvent.findMany({
        where: { account: { userId } }, ...paging, orderBy: { sequence: 'desc' },
        select: { id: true, type: true, title: true, used: true, createdAt: true },
      });
      break;
    case 'requests':
      entries = (await prisma.accountRequest.findMany({
        where: { userId }, ...paging, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })).map(serializeAccountRequest);
      break;
  }
  return { section, page, entries: entries.slice(0, PAGE_SIZE), hasMore: entries.length > PAGE_SIZE };
}
