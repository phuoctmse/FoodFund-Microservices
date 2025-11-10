-- AlterTable: Remove donation_count column from campaigns table
-- Reason: donation_count is no longer needed because:
--   1. Supplementary payments don't increment donation_count (causes confusion)
--   2. Can be calculated from donations table: COUNT(DISTINCT donation_id)
--   3. Prevents data inconsistency
--   4. Sorting by donation count replaced with sorting by received_amount

-- Drop index on donation_count first
DROP INDEX IF EXISTS "campaigns_donation_count_idx";

-- Remove donation_count column
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "donation_count";
