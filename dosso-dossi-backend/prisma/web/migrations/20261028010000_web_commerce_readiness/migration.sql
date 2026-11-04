-- CreateEnum
CREATE TYPE "WebOrderReturnStatus" AS ENUM ('REQUESTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WebOrderMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WebFranchiseStatus" AS ENUM ('NEW', 'IN_REVIEW', 'CONTACTED', 'CLOSED');

-- AlterTable
ALTER TABLE "WebProduct" ADD COLUMN     "details" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "WebOrderReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "WebOrderReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "resolutionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebOrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebOrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebOrderMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebOrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebFranchiseInquiry" (
    "id" TEXT NOT NULL,
    "receipt" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "space" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "privacyAcknowledgedAt" TIMESTAMP(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL DEFAULT 'franchise-2026-10',
    "status" "WebFranchiseStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebFranchiseInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebOrderReturn_orderId_key" ON "WebOrderReturn"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebOrderMessage_dedupeKey_key" ON "WebOrderMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "WebOrderMessage_status_availableAt_idx" ON "WebOrderMessage"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebFranchiseInquiry_receipt_key" ON "WebFranchiseInquiry"("receipt");

-- CreateIndex
CREATE INDEX "WebFranchiseInquiry_status_createdAt_idx" ON "WebFranchiseInquiry"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WebOrderReturn" ADD CONSTRAINT "WebOrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderMessage" ADD CONSTRAINT "WebOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
