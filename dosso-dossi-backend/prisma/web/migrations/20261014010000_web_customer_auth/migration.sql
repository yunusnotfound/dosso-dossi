CREATE TYPE "WebCustomerTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE "WebCustomer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "verificationRequestedAt" TIMESTAMP(3),
    "resetRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebCustomer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebCustomer_locale_check" CHECK ("locale" IN ('tr', 'en')),
    CONSTRAINT "WebCustomer_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
CREATE UNIQUE INDEX "WebCustomer_email_key" ON "WebCustomer"("email");

CREATE TABLE "WebCustomerSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebCustomerSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebCustomerSession_tokenHash_key" ON "WebCustomerSession"("tokenHash");
CREATE INDEX "WebCustomerSession_customerId_idx" ON "WebCustomerSession"("customerId");
CREATE INDEX "WebCustomerSession_expiresAt_idx" ON "WebCustomerSession"("expiresAt");
ALTER TABLE "WebCustomerSession" ADD CONSTRAINT "WebCustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebCustomerToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "WebCustomerTokenPurpose" NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "WebCustomerToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebCustomerToken_tokenHash_key" ON "WebCustomerToken"("tokenHash");
CREATE INDEX "WebCustomerToken_customerId_purpose_idx" ON "WebCustomerToken"("customerId", "purpose");
CREATE INDEX "WebCustomerToken_expiresAt_idx" ON "WebCustomerToken"("expiresAt");
ALTER TABLE "WebCustomerToken" ADD CONSTRAINT "WebCustomerToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
