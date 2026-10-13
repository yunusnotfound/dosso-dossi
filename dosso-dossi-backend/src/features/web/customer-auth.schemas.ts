import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(254).email();
const password = z.string().min(12).max(128);
const locale = z.enum(['tr', 'en']);
const token = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
export const customerRegisterInput = z.object({ name: z.string().trim().min(2).max(120), email, password, locale }).strict();
// Login accepts previous/incorrect short passwords so it cannot disclose which
// password rules an existing account was registered under.
export const customerLoginInput = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const customerEmailInput = z.object({ email, locale }).strict();
// The email owner chooses the activation password. This prevents someone who
// pre-registered another person's address from retaining a known password.
export const customerVerifyInput = z.object({ token, password }).strict();
export const customerResetInput = z.object({ token, password }).strict();
