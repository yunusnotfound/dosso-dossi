import { env } from '../../../config/env.js';
import { paymentProvider as developmentProvider } from './dev-payment-provider.js';
import { IyzicoPaymentProvider } from './iyzico-payment-provider.js';
import type { PaymentProvider } from './payment-provider.js';

/** Missing iyzico credentials leave checkout unavailable; they never enable simulated money. */
export const paymentProvider: PaymentProvider = env.PAYMENT_PROVIDER === 'dev'
  ? developmentProvider
  : new IyzicoPaymentProvider({
      environment: env.IYZICO_ENVIRONMENT,
      apiKey: env.IYZICO_API_KEY,
      secretKey: env.IYZICO_SECRET_KEY,
      callbackUrl: env.IYZICO_CALLBACK_URL,
      timeoutMs: env.IYZICO_TIMEOUT_MS,
    });
