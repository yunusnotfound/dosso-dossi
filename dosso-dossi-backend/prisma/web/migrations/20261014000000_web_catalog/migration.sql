-- CreateEnum
CREATE TYPE "WebAdminRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "WebProductType" AS ENUM ('COFFEE', 'THERMOS');

-- CreateEnum
CREATE TYPE "WebProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "WebAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "WebAdminRole" NOT NULL DEFAULT 'ADMIN',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebMedia" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WebProductType" NOT NULL,
    "status" "WebProductStatus" NOT NULL DEFAULT 'DRAFT',
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionTr" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "altTr" TEXT NOT NULL DEFAULT '',
    "altEn" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "labelTr" TEXT NOT NULL DEFAULT '',
    "labelEn" TEXT NOT NULL DEFAULT '',
    "colorNameTr" TEXT,
    "colorNameEn" TEXT,
    "colorHex" TEXT,
    "weightGrams" INTEGER,
    "volumeMl" INTEGER,
    "priceMinor" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageId" TEXT,

    CONSTRAINT "WebProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebGrindOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "priceDeltaMinor" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WebGrindOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebCatalogAudit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebCatalogAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebStockAdjustment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "adminId" TEXT,
    "previous" INTEGER NOT NULL,
    "current" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebStockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAdmin_email_key" ON "WebAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WebAdminSession_tokenHash_key" ON "WebAdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "WebAdminSession_expiresAt_idx" ON "WebAdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebMedia_filename_key" ON "WebMedia"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "WebProduct_slug_key" ON "WebProduct"("slug");

-- CreateIndex
CREATE INDEX "WebProduct_status_sortOrder_idx" ON "WebProduct"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WebProductImage_productId_mediaId_key" ON "WebProductImage"("productId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "WebProductVariant_sku_key" ON "WebProductVariant"("sku");

-- CreateIndex
CREATE INDEX "WebProductVariant_productId_idx" ON "WebProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WebGrindOption_productId_code_key" ON "WebGrindOption"("productId", "code");

-- CreateIndex
CREATE INDEX "WebCatalogAudit_productId_createdAt_idx" ON "WebCatalogAudit"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "WebStockAdjustment_productId_createdAt_idx" ON "WebStockAdjustment"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "WebAdminSession" ADD CONSTRAINT "WebAdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "WebAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebProductImage" ADD CONSTRAINT "WebProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WebProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebProductImage" ADD CONSTRAINT "WebProductImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "WebMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebProductVariant" ADD CONSTRAINT "WebProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WebProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebGrindOption" ADD CONSTRAINT "WebGrindOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WebProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebCatalogAudit" ADD CONSTRAINT "WebCatalogAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WebProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebCatalogAudit" ADD CONSTRAINT "WebCatalogAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "WebAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebStockAdjustment" ADD CONSTRAINT "WebStockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WebProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebStockAdjustment" ADD CONSTRAINT "WebStockAdjustment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "WebAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prices are integer TRY kuruş; grinding never owns independent inventory.
ALTER TABLE "WebProductVariant" ADD CONSTRAINT "WebProductVariant_nonnegative" CHECK ("priceMinor" >= 0 AND "priceMinor" <= 100000000 AND "stock" >= 0 AND "stock" <= 1000000);
ALTER TABLE "WebProductVariant" ADD CONSTRAINT "WebProductVariant_positive_dimensions" CHECK (("weightGrams" IS NULL OR "weightGrams" > 0) AND ("volumeMl" IS NULL OR "volumeMl" > 0));
ALTER TABLE "WebGrindOption" ADD CONSTRAINT "WebGrindOption_nonnegative" CHECK ("priceDeltaMinor" >= 0 AND "priceDeltaMinor" <= 100000000);
ALTER TABLE "WebProduct" ADD CONSTRAINT "WebProduct_positive_version" CHECK ("version" > 0);
ALTER TABLE "WebStockAdjustment" ADD CONSTRAINT "WebStockAdjustment_nonnegative" CHECK ("previous" >= 0 AND "current" >= 0);
