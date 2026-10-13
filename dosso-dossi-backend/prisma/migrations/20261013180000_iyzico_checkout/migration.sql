ALTER TABLE "PaymentIntent"
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "providerTransactions" JSONB,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3);

ALTER TABLE "WalletTransaction" ADD COLUMN "paymentIntentId" TEXT;
CREATE UNIQUE INDEX "PaymentIntent_providerPaymentId_key" ON "PaymentIntent"("providerPaymentId");
CREATE UNIQUE INDEX "WalletTransaction_paymentIntentId_key" ON "WalletTransaction"("paymentIntentId");
CREATE INDEX "PaymentIntent_provider_status_lastCheckedAt_idx" ON "PaymentIntent"("provider", "status", "lastCheckedAt");
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
