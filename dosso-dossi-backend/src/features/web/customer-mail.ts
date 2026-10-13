import { randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

export type CustomerMailPurpose = 'verify-email' | 'reset-password';
export type CustomerMailInput = {
  to: string;
  name: string;
  locale: 'tr' | 'en';
  purpose: CustomerMailPurpose;
  token: string;
  idempotencyKey: string;
};
export type CustomerMailConfiguration = {
  delivery: 'preview' | 'resend';
  publicUrl: string;
  from: string;
  apiKey?: string;
};
export type CustomerMailResult = { delivery: 'preview' | 'resend'; id?: string };

export class CustomerMailConfigurationError extends Error {
  constructor(message = 'Web e-posta servisi henüz yapılandırılmadı.') {
    super(message);
    this.name = 'CustomerMailConfigurationError';
  }
}
export class CustomerMailDeliveryError extends Error {
  constructor() {
    // Provider errors can contain recipient addresses or submitted content.
    // Never retain their response body, token-bearing URL, or credentials here.
    super('E-posta şu anda gönderilemedi. Lütfen tekrar deneyin.');
    this.name = 'CustomerMailDeliveryError';
  }
}

const emailAddress = z.email();
const isLoopback = (hostname: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);

/** Read lazily so mobile-only startup never requires web email credentials. */
export function getCustomerMailConfiguration(
  source: NodeJS.ProcessEnv = process.env,
): CustomerMailConfiguration {
  const environment = source.NODE_ENV ?? 'development';
  const mode = source.WEB_EMAIL_MODE ?? (environment === 'development' ? 'preview' : 'disabled');
  if (!['preview', 'resend', 'disabled'].includes(mode)) {
    throw new CustomerMailConfigurationError('WEB_EMAIL_MODE geçersiz.');
  }
  if (mode === 'disabled') throw new CustomerMailConfigurationError();
  if (mode === 'preview' && !['development', 'test'].includes(environment)) {
    throw new CustomerMailConfigurationError('E-posta önizlemesi yalnızca yerel geliştirmede kullanılabilir.');
  }

  const configuredUrl = source.WEB_PUBLIC_URL?.trim()
    || (environment === 'development' || environment === 'test' ? 'http://127.0.0.1:4000' : '');
  let publicUrl: URL;
  try { publicUrl = new URL(configuredUrl); }
  catch { throw new CustomerMailConfigurationError('WEB_PUBLIC_URL geçerli bir site origin adresi olmalı.'); }
  if (!['http:', 'https:'].includes(publicUrl.protocol)
    || publicUrl.username || publicUrl.password
    || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash
    || (environment === 'production' && publicUrl.protocol !== 'https:')
    || (mode === 'preview' && !isLoopback(publicUrl.hostname))) {
    throw new CustomerMailConfigurationError('WEB_PUBLIC_URL e-posta modu için geçersiz.');
  }

  const from = source.WEB_EMAIL_FROM?.trim()
    || (mode === 'preview' ? 'Dosso Dossi Coffee <preview@localhost.invalid>' : '');
  const sender = /^(?:[^<>]+<([^<>]+)>|([^<>]+))$/.exec(from);
  if (!sender || from.length > 320 || /[\u0000-\u001f\u007f]/.test(from)
    || !emailAddress.safeParse((sender[1] ?? sender[2] ?? '').trim()).success) {
    throw new CustomerMailConfigurationError('WEB_EMAIL_FROM geçerli bir gönderen adresi olmalı.');
  }
  const apiKey = source.RESEND_API_KEY?.trim();
  if (mode === 'resend' && (!apiKey || /\s/.test(apiKey))) {
    throw new CustomerMailConfigurationError('RESEND_API_KEY yapılandırılmalı.');
  }
  return { delivery: mode as 'preview' | 'resend', publicUrl: publicUrl.origin, from, ...(mode === 'resend' ? { apiKey } : {}) };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

function messageFor(input: CustomerMailInput, config: CustomerMailConfiguration) {
  // URLs carry the secret in a fragment so opening a link does not send it to
  // server logs. The account page submits it only after an explicit action.
  const prefix = input.locale === 'en' ? '/en' : '';
  const actionPath = input.purpose === 'verify-email' ? '/hesabim/dogrula' : '/hesabim/sifre-yenile';
  const actionUrl = new URL(`${prefix}${actionPath}`, config.publicUrl);
  actionUrl.hash = new URLSearchParams({ token: input.token }).toString();
  const copy = input.locale === 'en'
    ? input.purpose === 'verify-email'
      ? { subject: 'Verify your Dosso Dossi email', greeting: 'Hello', intro: 'Confirm your email address and choose your final account password to complete your Dosso Dossi Coffee membership.', action: 'Complete membership', expiry: 'This link is valid for 24 hours and can only be used once.', ignore: 'If you did not create this account, you can ignore this email.' }
      : { subject: 'Reset your Dosso Dossi password', greeting: 'Hello', intro: 'We received a request to reset the password for your Dosso Dossi Coffee account.', action: 'Reset password', expiry: 'This link is valid for 1 hour and can only be used once.', ignore: 'If you did not request this, ignore this email. Your password will remain unchanged.' }
    : input.purpose === 'verify-email'
      ? { subject: 'Dosso Dossi e-posta adresinizi doğrulayın', greeting: 'Merhaba', intro: 'Dosso Dossi Coffee üyeliğinizi tamamlamak için e-posta adresinizi doğrulayın ve hesabınızda kullanacağınız şifreyi belirleyin.', action: 'Üyeliğimi tamamla', expiry: 'Bu bağlantı 24 saat geçerlidir ve yalnızca bir kez kullanılabilir.', ignore: 'Bu hesabı siz oluşturmadıysanız bu e-postayı dikkate almayabilirsiniz.' }
      : { subject: 'Dosso Dossi şifrenizi yenileyin', greeting: 'Merhaba', intro: 'Dosso Dossi Coffee hesabınızın şifresini yenilemek için bir talep aldık.', action: 'Şifremi yenile', expiry: 'Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.', ignore: 'Bu talebi siz oluşturmadıysanız bu e-postayı dikkate almayın. Şifreniz değişmeyecektir.' };
  const greeting = `${copy.greeting}${input.name.trim() ? ` ${input.name.trim()}` : ''},`;
  const url = actionUrl.toString();
  return {
    from: config.from,
    to: [input.to],
    subject: copy.subject,
    text: `${greeting}\n\n${copy.intro}\n\n${copy.action}: ${url}\n\n${copy.expiry}\n\n${copy.ignore}\n\nDosso Dossi Coffee`,
    html: `<!doctype html><html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:32px 16px;background:#f5f1e9;color:#292522;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:32px;background:#fff;border-top:5px solid #bd4f2a"><p style="font-size:13px;letter-spacing:2px;font-weight:bold">DOSSO DOSSI COFFEE</p><h1 style="font-size:24px;line-height:1.3">${escapeHtml(copy.subject)}</h1><p>${escapeHtml(greeting)}</p><p style="line-height:1.7">${escapeHtml(copy.intro)}</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#bd4f2a;color:white;text-decoration:none;font-weight:bold">${escapeHtml(copy.action)}</a></p><p style="line-height:1.7">${escapeHtml(copy.expiry)}</p><p style="font-size:13px;line-height:1.7;color:#625c56">${escapeHtml(copy.ignore)}</p></div></body></html>`,
  };
}

export async function sendCustomerEmail(input: CustomerMailInput): Promise<CustomerMailResult> {
  const config = getCustomerMailConfiguration();
  if (!emailAddress.safeParse(input.to).success
    || !['tr', 'en'].includes(input.locale)
    || !['verify-email', 'reset-password'].includes(input.purpose)
    || !/^[A-Za-z0-9_-]{32,512}$/.test(input.token)
    || !/^[A-Za-z0-9:_.\/-]{1,256}$/.test(input.idempotencyKey)
    || input.name.length > 200) throw new CustomerMailDeliveryError();
  const message = messageFor(input, config);
  if (config.delivery === 'preview') {
    try {
      const directory = path.resolve('.local/web-emails');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      const id = randomUUID();
      await writeFile(path.join(directory, `${id}.html`), message.html, { mode: 0o600, flag: 'wx' });
      await writeFile(path.join(directory, `${id}.json`), JSON.stringify({
        createdAt: new Date().toISOString(), purpose: input.purpose, ...message,
      }, null, 2), { mode: 0o600, flag: 'wx' });
      return { delivery: 'preview' };
    } catch { throw new CustomerMailDeliveryError(); }
  }

  // Retry only transport failures, throttling and provider outages. Reuse the
  // exact payload and key so an uncertain first response cannot send twice.
  const body = JSON.stringify(message);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
        body,
        signal: AbortSignal.timeout(5_000),
        redirect: 'error',
      });
    } catch {
      if (attempt === 0) { await delay(250); continue; }
      throw new CustomerMailDeliveryError();
    }
    if (response.ok) {
      // Delivery acceptance is already authoritative; a malformed response
      // body must not provoke another send or expose provider response data.
      const result: unknown = await response.json().catch(() => null);
      const id = typeof result === 'object' && result !== null && 'id' in result && typeof result.id === 'string' ? result.id : undefined;
      return { delivery: 'resend', ...(id ? { id } : {}) };
    }
    await response.body?.cancel().catch(() => undefined);
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await delay(250);
      continue;
    }
    throw new CustomerMailDeliveryError();
  }
  throw new CustomerMailDeliveryError();
}
