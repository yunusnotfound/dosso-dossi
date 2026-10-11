-- Additive: existing campaign, customer and financial data remain unchanged.
CREATE TABLE "CampaignStory" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "description" VARCHAR(400) NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT 'none',
    "actionLabel" VARCHAR(40) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignStory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CampaignStory_action_check" CHECK ("action" IN ('none', 'kahve-ictikce', 'yukle-kazan', 'online-magaza', 'siparis')),
    CONSTRAINT "CampaignStory_sortOrder_check" CHECK ("sortOrder" BETWEEN 0 AND 999),
    CONSTRAINT "CampaignStory_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt")
);
CREATE INDEX "CampaignStory_isActive_sortOrder_idx" ON "CampaignStory"("isActive", "sortOrder");

INSERT INTO "CampaignStory" ("id", "title", "description", "action", "actionLabel", "sortOrder") VALUES
('story-coffee-rewards', 'Kahve Kazan', 'Kahve keyfin hediyeye dönüşsün. Kampanyayı keşfet.', 'kahve-ictikce', 'Kampanyayı keşfet', 0),
('story-topup-rewards', 'Yükle Kazan', 'Dosso Dossi Kart ile yükleme avantajlarını keşfet.', 'yukle-kazan', 'Kampanyayı keşfet', 1);
