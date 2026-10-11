ALTER TYPE "WalletTxType" ADD VALUE 'ADJUSTMENT';
ALTER TABLE "User" ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE TYPE "AccountRequestKind" AS ENUM ('CLOSURE', 'DATA_EXPORT');
CREATE TYPE "AccountRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "NotificationKind" AS ENUM ('ORDER_STATUS', 'GIFT_RECEIVED', 'ACCOUNT_REQUEST', 'CAMPAIGN');

CREATE TABLE "AccountRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "AccountRequestKind" NOT NULL,
  "status" "AccountRequestStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT NOT NULL DEFAULT '',
  "response" TEXT NOT NULL DEFAULT '',
  "openKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountRequest_openKey_key" ON "AccountRequest"("openKey");
CREATE INDEX "AccountRequest_userId_createdAt_idx" ON "AccountRequest"("userId", "createdAt");
CREATE INDEX "AccountRequest_status_createdAt_idx" ON "AccountRequest"("status", "createdAt");

CREATE TABLE "UserNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetPath" TEXT NOT NULL DEFAULT '',
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserNotification_userId_dedupeKey_key" ON "UserNotification"("userId", "dedupeKey");
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");
