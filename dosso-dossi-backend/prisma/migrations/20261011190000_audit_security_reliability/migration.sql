ALTER TABLE "AdminUser" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3);

ALTER TABLE "RefreshToken" ADD COLUMN "familyId" TEXT, ADD COLUMN "familyRevokedAt" TIMESTAMP(3);
ALTER TABLE "AdminRefreshToken" ADD COLUMN "familyId" TEXT, ADD COLUMN "familyRevokedAt" TIMESTAMP(3);
-- Existing session chains predate family identifiers. Keep them in an isolated
-- legacy family; every subsequent login starts a fresh independent family.
UPDATE "RefreshToken" SET "familyId" = 'legacy-user-' || "userId";
UPDATE "AdminRefreshToken" SET "familyId" = 'legacy-admin-' || "adminId";
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "AdminRefreshToken" ALTER COLUMN "familyId" SET NOT NULL;
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");
CREATE INDEX "AdminRefreshToken_adminId_familyId_idx" ON "AdminRefreshToken"("adminId", "familyId");

CREATE TABLE "AdminMutationRequest" (
  "id" TEXT NOT NULL, "adminId" TEXT NOT NULL, "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminMutationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminMutationRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminMutationRequest_adminId_scope_key_key" ON "AdminMutationRequest"("adminId", "scope", "key");

CREATE TABLE "SyncRevision" (
  "key" TEXT NOT NULL, "version" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "SyncRevision_pkey" PRIMARY KEY ("key")
);
