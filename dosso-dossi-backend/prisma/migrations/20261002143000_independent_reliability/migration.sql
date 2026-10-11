-- Additive session revocation and request identity; existing balances are untouched.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminUser" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "WalletTransaction_orderId_key";
CREATE UNIQUE INDEX "WalletTransaction_orderId_type_key" ON "WalletTransaction"("orderId", "type");
CREATE TABLE "FinancialRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "resourceId" TEXT,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialRequest_userId_scope_key_key" ON "FinancialRequest"("userId", "scope", "key");
ALTER TABLE "FinancialRequest" ADD CONSTRAINT "FinancialRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
