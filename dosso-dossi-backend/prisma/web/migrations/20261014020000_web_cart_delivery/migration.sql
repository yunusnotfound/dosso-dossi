ALTER TABLE "WebStoreSettings" ADD COLUMN "shippingFeeMinor" INTEGER,
    ADD COLUMN "freeShippingThresholdMinor" INTEGER,
    ADD COLUMN "shippingVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "shippingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WebStoreSettings" ADD CONSTRAINT "WebStoreSettings_shipping_values" CHECK (
    ("shippingFeeMinor" IS NULL OR "shippingFeeMinor" BETWEEN 0 AND 100000000) AND
    ("freeShippingThresholdMinor" IS NULL OR "freeShippingThresholdMinor" BETWEEN 1 AND 100000000) AND
    ("shippingFeeMinor" IS NOT NULL OR "freeShippingThresholdMinor" IS NULL)
);
CREATE TABLE "WebCart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deliveryAddressId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebCart_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "grindId" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "nameTr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "variantLabelTr" TEXT NOT NULL DEFAULT '',
    "variantLabelEn" TEXT NOT NULL DEFAULT '',
    "grindNameTr" TEXT,
    "grindNameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebCartItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebCartItem_quantity" CHECK ("quantity" BETWEEN 1 AND 99)
);
CREATE TABLE "WebDeliveryAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'TR',
    "provinceCode" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebDeliveryAddress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebDeliveryAddress_turkey" CHECK ("country" = 'TR' AND "provinceCode" ~ '^(0[1-9]|[1-7][0-9]|8[01])$'),
    CONSTRAINT "WebDeliveryAddress_phone" CHECK ("phone" ~ '^\+90[2-5][0-9]{9}$'),
    CONSTRAINT "WebDeliveryAddress_postal" CHECK ("postalCode" = '' OR ("postalCode" ~ '^[0-9]{5}$' AND LEFT("postalCode", 2) = "provinceCode"))
);
CREATE TABLE "WebShippingAudit" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebShippingAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebCart_customerId_key" ON "WebCart"("customerId");
CREATE UNIQUE INDEX "WebCartItem_cartId_variantId_grindId_key" ON "WebCartItem"("cartId", "variantId", "grindId");
CREATE INDEX "WebCartItem_cartId_idx" ON "WebCartItem"("cartId");
CREATE INDEX "WebDeliveryAddress_customerId_createdAt_idx" ON "WebDeliveryAddress"("customerId", "createdAt");
CREATE UNIQUE INDEX "WebDeliveryAddress_one_default_per_customer" ON "WebDeliveryAddress"("customerId") WHERE "isDefault" = true;
ALTER TABLE "WebCart" ADD CONSTRAINT "WebCart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebCartItem" ADD CONSTRAINT "WebCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "WebCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebDeliveryAddress" ADD CONSTRAINT "WebDeliveryAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
