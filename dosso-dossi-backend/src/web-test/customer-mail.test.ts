import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerMailConfigurationError,
  CustomerMailDeliveryError,
  getCustomerMailConfiguration,
  sendCustomerEmail,
  type CustomerMailInput,
} from '../features/web/customer-mail.js';

const input: CustomerMailInput = {
  to: 'customer@example.com',
  name: 'Yunus <script>alert("x")</script> & Test',
  locale: 'tr',
  purpose: 'verify-email',
  token: 'x'.repeat(64),
  idempotencyKey: 'verify-email/1234-5678',
};
const resendEnvironment = {
  NODE_ENV: 'production',
  WEB_EMAIL_MODE: 'resend',
  WEB_PUBLIC_URL: 'https://coffee.example.com',
  WEB_EMAIL_FROM: 'Dosso Dossi Coffee <hello@example.com>',
  RESEND_API_KEY: 're_fake_unit_test_not_live',
};
function useResend() {
  for (const [key, value] of Object.entries(resendEnvironment)) vi.stubEnv(key, value);
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isolated web customer mail configuration', () => {
  it('defaults only development to local preview, never exposing an optional provider key', () => {
    expect(getCustomerMailConfiguration({ NODE_ENV: 'development', RESEND_API_KEY: 'unused' })).toEqual({
      delivery: 'preview', publicUrl: 'http://127.0.0.1:4000', from: 'Dosso Dossi Coffee <preview@localhost.invalid>',
    });
  });
  it.each(['production', 'test', 'staging'])('fails closed without explicit email mode in %s', (environment) => {
    expect(() => getCustomerMailConfiguration({ NODE_ENV: environment })).toThrow(CustomerMailConfigurationError);
  });
  it('never enables preview in production or staging', () => {
    for (const NODE_ENV of ['production', 'staging']) {
      expect(() => getCustomerMailConfiguration({ NODE_ENV, WEB_EMAIL_MODE: 'preview' })).toThrow(CustomerMailConfigurationError);
    }
  });
  it.each([
    'http://coffee.example.com', 'https://coffee.example.com', 'https://localhost.example.com',
  ])('requires loopback for preview: %s', (WEB_PUBLIC_URL) => {
    expect(() => getCustomerMailConfiguration({ NODE_ENV: 'development', WEB_EMAIL_MODE: 'preview', WEB_PUBLIC_URL })).toThrow(CustomerMailConfigurationError);
  });
  it.each([
    'https://user:password@coffee.example.com', 'https://coffee.example.com/path',
    'https://coffee.example.com?token=ignored', 'https://coffee.example.com#fragment',
    'http://coffee.example.com', 'javascript:alert(1)', '',
  ])('rejects unsafe production origins: %s', (WEB_PUBLIC_URL) => {
    expect(() => getCustomerMailConfiguration({ ...resendEnvironment, WEB_PUBLIC_URL })).toThrow(CustomerMailConfigurationError);
  });
  it('canonicalizes the configured HTTPS origin', () => {
    expect(getCustomerMailConfiguration({ ...resendEnvironment, WEB_PUBLIC_URL: 'https://COFFEE.example.com:443/' }).publicUrl).toBe('https://coffee.example.com');
  });
  it.each([
    { RESEND_API_KEY: '' }, { RESEND_API_KEY: 'secret\r\nInjected: header' },
    { WEB_EMAIL_FROM: '' }, { WEB_EMAIL_FROM: 'not-an-email' },
    { WEB_EMAIL_FROM: 'Dosso\r\nBcc: other@example.com <hello@example.com>' },
    { WEB_EMAIL_MODE: 'invalid' }, { WEB_EMAIL_MODE: 'disabled' },
  ])('rejects invalid or missing provider settings without disclosing secrets: %j', (override) => {
    expect(() => getCustomerMailConfiguration({ ...resendEnvironment, ...override })).toThrow(CustomerMailConfigurationError);
  });
});

describe('customer email transport and templates', () => {
  it('uses only the fixed Resend endpoint and escaped HTML with a token fragment', async () => {
    useResend();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-accepted' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).resolves.toEqual({ delivery: 'resend', id: 'email-accepted' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: {
      Authorization: `Bearer ${resendEnvironment.RESEND_API_KEY}`,
      'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey,
    } });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const message = JSON.parse(options.body);
    expect(message.to).toEqual([input.to]);
    expect(message.from).toBe(resendEnvironment.WEB_EMAIL_FROM);
    expect(message.subject).toBe('Dosso Dossi e-posta adresinizi doğrulayın');
    expect(message.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Test');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain(`href="https://coffee.example.com/hesabim/dogrula#token=${input.token}"`);
    expect(message.text).toContain(`https://coffee.example.com/hesabim/dogrula#token=${input.token}`);
    expect(message.text).not.toContain('?token=');
    expect(message.text).toContain('hesabınızda kullanacağınız şifreyi belirleyin');
    expect(message.html).not.toContain(resendEnvironment.RESEND_API_KEY);
  });
  it('renders the English reset flow at the correct account path', async () => {
    useResend();
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await sendCustomerEmail({ ...input, locale: 'en', purpose: 'reset-password' });
    const message = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(message.html).toContain('<html lang="en">');
    expect(message.subject).toBe('Reset your Dosso Dossi password');
    expect(message.text).toContain(`/en/hesabim/sifre-yenile#token=${input.token}`);
    expect(message.text).toContain('1 hour');
  });
  it.each([429, 500, 503])('retries provider %s only once with identical body and idempotency key', async (status) => {
    useResend();
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('private provider details', { status }))
      .mockResolvedValueOnce(new Response('{"id":"accepted"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).resolves.toEqual({ delivery: 'resend', id: 'accepted' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].body).toEqual(fetch.mock.calls[1]![1].body);
    expect(fetch.mock.calls[0]![1].headers).toEqual(fetch.mock.calls[1]![1].headers);
  });
  it('retries uncertain network failures using the original idempotency key', async () => {
    useResend();
    const fetch = vi.fn().mockRejectedValueOnce(new Error('private network detail'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).resolves.toEqual({ delivery: 'resend' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].headers).toEqual(fetch.mock.calls[1]![1].headers);
  });
  it.each([400, 401, 403, 422])('does not retry provider %s and hides provider response details', async (status) => {
    useResend();
    const fetch = vi.fn().mockResolvedValue(new Response(`private-${input.token}`, { status }));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).rejects.toEqual(new CustomerMailDeliveryError());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('stops after two provider failures', async () => {
    useResend();
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('unavailable', { status: 503 })));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).rejects.toBeInstanceOf(CustomerMailDeliveryError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not repeat accepted delivery when a provider response has no JSON body', async () => {
    useResend();
    const fetch = vi.fn().mockResolvedValue(new Response('accepted', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail(input)).resolves.toEqual({ delivery: 'resend' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid recipient or injected idempotency headers before sending', async () => {
    useResend();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(sendCustomerEmail({ ...input, to: 'bad\r\n@example.com' })).rejects.toBeInstanceOf(CustomerMailDeliveryError);
    await expect(sendCustomerEmail({ ...input, idempotencyKey: 'secret\r\nX-Test: header' })).rejects.toBeInstanceOf(CustomerMailDeliveryError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('writes private local previews without contacting a mail provider', async () => {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'dosso-customer-mail-'));
    vi.spyOn(process, 'cwd').mockReturnValue(temporaryDirectory);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('WEB_EMAIL_MODE', 'preview');
    vi.stubEnv('WEB_PUBLIC_URL', 'http://127.0.0.1:4000');
    vi.stubEnv('WEB_EMAIL_FROM', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    try {
      await expect(sendCustomerEmail(input)).resolves.toEqual({ delivery: 'preview' });
      expect(fetch).not.toHaveBeenCalled();
      const directory = path.join(temporaryDirectory, '.local/web-emails');
      const files = await readdir(directory);
      expect(files).toHaveLength(2);
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      for (const filename of files) expect((await stat(path.join(directory, filename))).mode & 0o777).toBe(0o600);
      const jsonFile = files.find((filename) => filename.endsWith('.json'))!;
      const preview = JSON.parse(await readFile(path.join(directory, jsonFile), 'utf8'));
      expect(preview.to).toEqual([input.to]);
      expect(preview.purpose).toBe('verify-email');
      expect(preview.text).toContain(`http://127.0.0.1:4000/hesabim/dogrula#token=${input.token}`);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
