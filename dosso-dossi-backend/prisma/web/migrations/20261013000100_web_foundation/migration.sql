CREATE TABLE "WebStoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "name" TEXT NOT NULL DEFAULT 'Dosso Dossi Coffee',
    "defaultLocale" TEXT NOT NULL DEFAULT 'tr',
    "locales" TEXT[] DEFAULT ARRAY['tr', 'en']::TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "shippingCountry" TEXT NOT NULL DEFAULT 'TR',

    CONSTRAINT "WebStoreSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebStoreSettings_single_store" CHECK ("id" = 'store')
);
