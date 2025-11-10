-- Add donation_count column to campaigns table
-- Purpose: Count successful Payment_Transactions (not Donations)
-- This aligns with getCampaignDonations API which displays individual payment transactions

-- Add column with default 0
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "donation_count" INTEGER NOT NULL DEFAULT 0;

-- Create index for sorting/filtering by donation_count
CREATE INDEX IF NOT EXISTS "campaigns_donation_count_idx" ON "campaigns"("donation_count");

-- Backfill existing data: Count successful Payment_Transactions per campaign
UPDATE "campaigns" c
SET "donation_count" = (
  SELECT COUNT(DISTINCT pt.id)
  FROM "donations" d
  INNER JOIN "payment_transactions" pt ON pt.donation_id = d.id
  WHERE d.campaign_id = c.id
    AND pt.status = 'SUCCESS'
);
