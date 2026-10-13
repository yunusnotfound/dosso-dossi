import { createHash, randomBytes } from 'node:crypto';
import { verify } from '@node-rs/argon2';
import type { PrismaClient, WebAdmin } from '@dosso-dossi/web-prisma';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../../lib/errors.js';

export const WEB_SESSION_TTL_SECONDS = 12 * 60 * 60;
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$mBP3M0BGZAQZH6HgQdOaBEZ5oR7BLzTLmYNJb1Aq3Qo';
export const hashSession = (token: string): string => createHash('sha256').update(token).digest('hex');
export const publicAdmin = (admin: Pick<WebAdmin, 'id' | 'email' | 'name' | 'role'>) => ({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
export function sessionToken(req: Request): string {
  const match = /^Bearer ([A-Za-z0-9_-]{64})$/.exec(req.headers.authorization ?? '');
  if (!match?.[1]) throw AppError.unauthorized('Web yönetici oturumu gerekli.');
  return match[1];
}
export function requireWebAdmin(database: () => PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await database().webAdminSession.findUnique({ where: { tokenHash: hashSession(sessionToken(req)) }, include: { admin: true } });
      if (!session || session.expiresAt <= new Date() || !session.admin.active) throw AppError.unauthorized('Web yönetici oturumu geçersiz veya süresi dolmuş.');
      if (!['ADMIN', 'EDITOR'].includes(session.admin.role)) throw AppError.forbidden();
      res.locals.webAdmin = publicAdmin(session.admin);
      next();
    } catch (error) { next(error); }
  };
}
export async function webAdminLogin(database: PrismaClient, email: string, password: string) {
  const admin = await database.webAdmin.findUnique({ where: { email } });
  const valid = await verify(admin?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!admin?.active || !valid) throw AppError.unauthorized('E-posta veya şifre hatalı.');
  const token = randomBytes(48).toString('base64url');
  await database.$transaction(async (tx) => {
    const current = await tx.webAdmin.findFirst({ where: { id: admin.id, active: true, passwordHash: admin.passwordHash } });
    if (!current) throw AppError.unauthorized();
    await tx.webAdminSession.deleteMany({ where: { adminId: admin.id, expiresAt: { lt: new Date() } } });
    await tx.webAdminSession.create({ data: { adminId: admin.id, tokenHash: hashSession(token), expiresAt: new Date(Date.now() + WEB_SESSION_TTL_SECONDS * 1000) } });
  });
  return { token, admin: publicAdmin(admin) };
}
/** Process-local, bounded stores; use shared storage before multi-instance deployment.
 * Next.js forwards logins from one server address, so the strict budget belongs to
 * the normalized account. The IP budget only protects against aggregate floods;
 * X-Forwarded-For is intentionally not read or trusted here.
 */
export function loginRateLimit(): {
  aggregate: RequestHandler;
  beginAccount: (email: string) => (result: 'success' | 'failure' | 'unavailable') => void;
} {
  const maximumKeys = 10000;
  const accountLimit = 10;
  const accounts = new Map<string, { failures: number; pending: number; reset: number }>();
  const addresses = new Map<string, { count: number; reset: number }>();
  const aggregate: RequestHandler = (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of addresses) if (entry.reset <= now) addresses.delete(key);
    const key = req.ip ?? 'unknown';
    if (!addresses.has(key) && addresses.size >= maximumKeys) { next(AppError.rateLimited()); return; }
    const entry = addresses.get(key) ?? { count: 0, reset: now + 5 * 60 * 1000 };
    entry.count += 1;
    addresses.set(key, entry);
    // Deliberately much higher than the per-account threshold: all normal panel
    // sessions behind the Next.js server share this address.
    if (entry.count > 300) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.reset - now) / 1000))));
      next(AppError.rateLimited()); return;
    }
    next();
  };
  return {
    aggregate,
    beginAccount(email) {
      const now = Date.now();
      for (const [key, entry] of accounts) if (entry.reset <= now && !entry.pending) accounts.delete(key);
      const key = hashSession(email.trim().toLowerCase());
      if (!accounts.has(key) && accounts.size >= maximumKeys) throw AppError.rateLimited();
      const entry = accounts.get(key) ?? { failures: 0, pending: 0, reset: now + 15 * 60 * 1000 };
      if (entry.failures + entry.pending >= accountLimit) throw AppError.rateLimited();
      entry.pending += 1;
      accounts.set(key, entry);
      let finished = false;
      return (result) => {
        if (finished) return;
        finished = true;
        entry.pending -= 1;
        if (result === 'failure') entry.failures += 1;
        else if (result === 'success') { entry.failures = 0; entry.reset = Date.now() + 15 * 60 * 1000; }
        // A successful login clears the failed-attempt budget. Infrastructure
        // errors do not penalize credentials or retain unnecessary account keys.
        if (!entry.failures && !entry.pending) accounts.delete(key);
      };
    },
  };
}
