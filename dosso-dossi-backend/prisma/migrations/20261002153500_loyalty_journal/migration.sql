-- Retain every existing event and balance. Metadata is written only by new operations.
ALTER TABLE "LoyaltyEvent" ADD COLUMN "sequence" BIGSERIAL NOT NULL;
ALTER TABLE "LoyaltyEvent" ADD COLUMN "metadata" JSONB;
CREATE UNIQUE INDEX "LoyaltyEvent_sequence_key" ON "LoyaltyEvent"("sequence");
