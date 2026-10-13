import { createHash, randomBytes } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Prisma, type PrismaClient, type WebCustomer, type WebCustomerTokenPurpose } from '@dosso-dossi/web-prisma';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../lib/errors.js';

export const CUSTOMER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CUSTOMER_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const CUSTOMER_RESET_TTL_SECONDS = 60 * 60;
export const CUSTOMER_EMAIL_COOLDOWN_SECONDS = 60;
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$mBP3M0BGZAQZH6HgQdOaBEZ5oR7BLzTLmYNJb1Aq3Qo';
export const hashCustomerSession = (token: string) => createHash('sha256').update(`web-customer-session:${token}`).digest('hex');
export const hashCustomerToken = (token: string, purpose: WebCustomerTokenPurpose) => createHash('sha256').update(`web-customer-token:${purpose}:${token}`).digest('hex');
export const publicCustomer = (customer: Pick<WebCustomer, 'id' | 'name' | 'email' | 'locale' | 'emailVerifiedAt'>) => ({ id: customer.id, name: customer.name, email: customer.email, locale: customer.locale, emailVerifiedAt: customer.emailVerifiedAt });
export class CustomerAuthError extends Error {
  constructor(public code: 'EMAIL_NOT_VERIFIED' | 'INVALID_TOKEN' | 'WEB_EMAIL_UNAVAILABLE', public status: number, message: string) { super(message); }
}
const invalidToken = () => new CustomerAuthError('INVALID_TOKEN', 400, 'Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir bağlantı isteyin.');
const hashPassword = (password: string) => hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

export function customerSessionToken(req: Request): string {
  const token = /^Bearer ([A-Za-z0-9_-]{64})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw AppError.unauthorized('Müşteri oturumu gerekli.');
  return token;
}

export function requireWebCustomer(database: () => PrismaClient, now: () => Date = () => new Date()): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await database().webCustomerSession.findUnique({ where: { tokenHash: hashCustomerSession(customerSessionToken(req)) }, include: { customer: true } });
      if (!session || session.expiresAt <= now() || !session.customer.active || !session.customer.emailVerifiedAt) throw AppError.unauthorized('Müşteri oturumu geçersiz veya süresi dolmuş.');
      res.locals.webCustomer = publicCustomer(session.customer);
      next();
    } catch (error) { next(error); }
  };
}

export async function registerCustomer(database: PrismaClient, input: { email: string; name: string; password: string; locale: 'tr' | 'en' }) {
  // Hash on both new and existing accounts to reduce response-time differences.
  const passwordHash = await hashPassword(input.password);
  const existing = await database.webCustomer.findUnique({ where: { email: input.email } });
  if (existing) return existing;
  try {
    return await database.webCustomer.create({ data: { email: input.email, name: input.name, locale: input.locale, passwordHash } });
  } catch (error) {
    // A concurrent registration must never overwrite the first password/profile.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    return database.webCustomer.findUniqueOrThrow({ where: { email: input.email } });
  }
}

export async function customerLogin(database: PrismaClient, email: string, password: string, now: () => Date = () => new Date()) {
  const customer = await database.webCustomer.findUnique({ where: { email } });
  const valid = await verify(customer?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!customer?.active || !valid) throw AppError.unauthorized('E-posta veya şifre hatalı.');
  const token = randomBytes(48).toString('base64url');
  const result = await database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${customer.id} FOR UPDATE`;
    const current = await tx.webCustomer.findUniqueOrThrow({ where: { id: customer.id } });
    if (!current.active || current.passwordHash !== customer.passwordHash) throw AppError.unauthorized('E-posta veya şifre hatalı.');
    if (!current.emailVerifiedAt) throw new CustomerAuthError('EMAIL_NOT_VERIFIED', 403, 'Giriş yapmadan önce e-posta adresinizi doğrulayın.');
    const time = now();
    await tx.webCustomerSession.deleteMany({ where: { customerId: current.id, expiresAt: { lte: time } } });
    await tx.webCustomerSession.create({ data: { customerId: current.id, tokenHash: hashCustomerSession(token), expiresAt: new Date(time.getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000) } });
    return publicCustomer(current);
  });
  return { token, customer: result };
}

export async function issueCustomerToken(database: PrismaClient, customerId: string, purpose: WebCustomerTokenPurpose, now: () => Date = () => new Date()) {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = hashCustomerToken(token, purpose);
  return database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${customerId} FOR UPDATE`;
    const customer = await tx.webCustomer.findUniqueOrThrow({ where: { id: customerId } });
    if (!customer.active || (purpose === 'VERIFY_EMAIL' ? Boolean(customer.emailVerifiedAt) : !customer.emailVerifiedAt)) return null;
    const time = now();
    const field = purpose === 'VERIFY_EMAIL' ? 'verificationRequestedAt' : 'resetRequestedAt';
    const previous = customer[field];
    if (previous && time.getTime() - previous.getTime() < CUSTOMER_EMAIL_COOLDOWN_SECONDS * 1000) return null;
    // Keep earlier unexpired links valid if a later email is lost or delayed.
    await tx.webCustomerToken.deleteMany({ where: { customerId, OR: [{ expiresAt: { lte: time } }, { consumedAt: { not: null } }] } });
    const issued = await tx.webCustomerToken.create({ data: {
      customerId, purpose, tokenHash,
      expiresAt: new Date(time.getTime() + (purpose === 'VERIFY_EMAIL' ? CUSTOMER_VERIFICATION_TTL_SECONDS : CUSTOMER_RESET_TTL_SECONDS) * 1000),
    } });
    await tx.webCustomer.update({ where: { id: customerId }, data: { [field]: time } });
    return { id: issued.id, token, customer, issuedAt: time, previous, field };
  });
}

export async function releaseCustomerToken(database: PrismaClient, claim: NonNullable<Awaited<ReturnType<typeof issueCustomerToken>>>) {
  await database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${claim.customer.id} FOR UPDATE`;
    await tx.webCustomerToken.deleteMany({ where: { id: claim.id, consumedAt: null } });
    // Only roll back this attempt, never a newer successful issuance.
    await tx.webCustomer.updateMany({ where: { id: claim.customer.id, [claim.field]: claim.issuedAt }, data: { [claim.field]: claim.previous } });
  });
}

async function consumeToken(database: PrismaClient, token: string, purpose: WebCustomerTokenPurpose, now: () => Date, passwordHash?: string) {
  const tokenHash = hashCustomerToken(token, purpose);
  const candidate = await database.webCustomerToken.findUnique({ where: { tokenHash } });
  if (!candidate || candidate.purpose !== purpose) throw invalidToken();
  await database.$transaction(async (tx) => {
    // This same customer lock is held by login, resend and password reset. It
    // ensures no login with the previous password survives a password reset.
    await tx.$queryRaw`SELECT "id" FROM "WebCustomer" WHERE "id"=${candidate.customerId} FOR UPDATE`;
    const customer = await tx.webCustomer.findUnique({ where: { id: candidate.customerId } });
    const time = now();
    if (!customer?.active || (purpose === 'VERIFY_EMAIL' ? Boolean(customer.emailVerifiedAt) : !customer.emailVerifiedAt)) throw invalidToken();
    const consumed = await tx.webCustomerToken.updateMany({ where: { id: candidate.id, purpose, consumedAt: null, expiresAt: { gt: time } }, data: { consumedAt: time } });
    if (consumed.count !== 1) throw invalidToken();
    await tx.webCustomerToken.updateMany({ where: { customerId: customer.id, purpose, consumedAt: null }, data: { consumedAt: time } });
    if (!passwordHash) throw invalidToken();
    if (purpose === 'VERIFY_EMAIL') {
      // Registration may have been initiated by someone other than the email
      // owner. Only the password chosen while consuming the email link survives.
      await tx.webCustomer.update({ where: { id: customer.id }, data: { emailVerifiedAt: time, passwordHash } });
      await tx.webCustomerSession.deleteMany({ where: { customerId: customer.id } });
    } else {
      await tx.webCustomer.update({ where: { id: customer.id }, data: { passwordHash } });
      await tx.webCustomerSession.deleteMany({ where: { customerId: customer.id } });
    }
  });
}
export async function verifyCustomerEmail(database: PrismaClient, token: string, password: string, now: () => Date = () => new Date()) {
  await consumeToken(database, token, 'VERIFY_EMAIL', now, await hashPassword(password));
}
export async function resetCustomerPassword(database: PrismaClient, token: string, password: string, now: () => Date = () => new Date()) {
  await consumeToken(database, token, 'RESET_PASSWORD', now, await hashPassword(password));
}
