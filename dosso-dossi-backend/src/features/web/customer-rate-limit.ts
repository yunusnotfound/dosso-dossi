import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { AppError } from '../../lib/errors.js';
import { CUSTOMER_EMAIL_COOLDOWN_SECONDS } from './customer-auth.js';

/** Per-process flood protection supplements the durable customer-row cooldown.
 * Keys are normalized-email hashes, never addresses; bounded memory and a high
 * separate IP limit accommodate customers sharing the Next.js server address.
 */
export function customerEmailRateLimit(now: () => Date = () => new Date()) {
  const entries = new Map<string, { count: number; resetAt: number; cooldownUntil: number }>();
  return (email: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD', res: Response) => {
    const time = now().getTime();
    for (const [key, value] of entries) if (value.resetAt <= time) entries.delete(key);
    const key = createHash('sha256').update(`${purpose}:${email}`).digest('hex');
    if (!entries.has(key) && entries.size >= 10000) throw AppError.rateLimited();
    const entry = entries.get(key) ?? { count: 0, resetAt: time + 60 * 60 * 1000, cooldownUntil: 0 };
    const retryAt = entry.count >= 10 ? entry.resetAt : entry.cooldownUntil;
    if (retryAt > time) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((retryAt - time) / 1000))));
      throw AppError.rateLimited('Yeni bağlantı istemeden önce lütfen bekleyin.');
    }
    const claimCooldown = time + CUSTOMER_EMAIL_COOLDOWN_SECONDS * 1000;
    entry.count += 1;
    entry.cooldownUntil = claimCooldown;
    entries.set(key, entry);
    // Keep the same cooldown on failed mail and unknown accounts. Releasing only
    // actual send failures would reveal account existence through the next 429.
  };
}
