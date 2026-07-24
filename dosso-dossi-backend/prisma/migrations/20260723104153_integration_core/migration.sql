-- CreateEnum
CREATE TYPE "PosEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "PosChargeStatus" AS ENUM ('APPROVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "posRef" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "chargeId" TEXT;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PosEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "response" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PosEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qrTokenId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PosChargeStatus" NOT NULL DEFAULT 'APPROVED',
    "saleRef" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "redirectUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "PosEvent_createdAt_idx" ON "PosEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PosEvent_source_eventType_externalId_key" ON "PosEvent"("source", "eventType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PosCharge_qrTokenId_key" ON "PosCharge"("qrTokenId");

-- CreateIndex
CREATE INDEX "PosCharge_userId_createdAt_idx" ON "PosCharge"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerRef_key" ON "PaymentIntent"("providerRef");

-- CreateIndex
CREATE INDEX "PaymentIntent_userId_createdAt_idx" ON "PaymentIntent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_chargeId_idx" ON "WalletTransaction"("chargeId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCharge" ADD CONSTRAINT "PosCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCharge" ADD CONSTRAINT "PosCharge_qrTokenId_fkey" FOREIGN KEY ("qrTokenId") REFERENCES "QrToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
