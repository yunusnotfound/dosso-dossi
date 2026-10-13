-- CreateEnum
CREATE TYPE "WebOrderStatus" AS ENUM ('OPEN', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WebPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REVIEW');

-- CreateEnum
CREATE TYPE "WebFulfillmentStatus" AS ENUM ('UNFULFILLED', 'PREPARING', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "WebPaymentAttemptStatus" AS ENUM ('INITIALIZING', 'READY', 'SUCCEEDED', 'FAILED', 'REVIEW');

-- CreateTable
CREATE TABLE "WebOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WebOrderStatus" NOT NULL DEFAULT 'OPEN',
    "paymentStatus" "WebPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" "WebFulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "subtotalMinor" INTEGER NOT NULL,
    "shippingFeeMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "addressSnapshot" JSONB NOT NULL,
    "shippingSnapshot" JSONB NOT NULL,
    "reservationExpiresAt" TIMESTAMP(3) NOT NULL,
    "stockReleasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "grindId" TEXT,
    "sku" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "variantLabelTr" TEXT NOT NULL,
    "variantLabelEn" TEXT NOT NULL,
    "grindNameTr" TEXT,
    "grindNameEn" TEXT,
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "WebOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "WebPaymentAttemptStatus" NOT NULL DEFAULT 'INITIALIZING',
    "token" TEXT,
    "paymentPageUrl" TEXT,
    "providerPaymentId" TEXT,
    "failureCode" TEXT,
    "verifiedDetails" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebOrderAudit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebOrderAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebOrder_number_key" ON "WebOrder"("number");

-- CreateIndex
CREATE INDEX "WebOrder_customerId_createdAt_idx" ON "WebOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "WebOrder_status_paymentStatus_reservationExpiresAt_idx" ON "WebOrder"("status", "paymentStatus", "reservationExpiresAt");

-- CreateIndex
CREATE INDEX "WebOrder_createdAt_idx" ON "WebOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebOrder_customerId_idempotencyKey_key" ON "WebOrder"("customerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WebOrderItem_orderId_idx" ON "WebOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "WebPaymentAttempt_conversationId_key" ON "WebPaymentAttempt"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "WebPaymentAttempt_token_key" ON "WebPaymentAttempt"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WebPaymentAttempt_providerPaymentId_key" ON "WebPaymentAttempt"("providerPaymentId");

-- CreateIndex
CREATE INDEX "WebPaymentAttempt_orderId_createdAt_idx" ON "WebPaymentAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "WebOrderAudit_orderId_createdAt_idx" ON "WebOrderAudit"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "WebOrder" ADD CONSTRAINT "WebOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderItem" ADD CONSTRAINT "WebOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPaymentAttempt" ADD CONSTRAINT "WebPaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderAudit" ADD CONSTRAINT "WebOrderAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WebOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Database backstops for atomic sellable stock and integer-money snapshots.
ALTER TABLE "WebProductVariant" ADD CONSTRAINT "WebProductVariant_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "WebOrder" ADD CONSTRAINT "WebOrder_money_valid" CHECK ("subtotalMinor" >= 0 AND "shippingFeeMinor" >= 0 AND "totalMinor" = "subtotalMinor" + "shippingFeeMinor" AND "currency" = 'TRY');
ALTER TABLE "WebOrderItem" ADD CONSTRAINT "WebOrderItem_money_valid" CHECK ("quantity" > 0 AND "unitPriceMinor" >= 0 AND "lineTotalMinor" = "unitPriceMinor" * "quantity");
