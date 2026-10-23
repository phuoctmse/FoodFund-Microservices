-- Migration to Sepay payment gateway
-- This migration updates payment_transactions table structure for Sepay webhook

-- AlterTable
ALTER TABLE "payment_transactions" 
ADD COLUMN IF NOT EXISTS "gateway" VARCHAR(100) NOT NULL DEFAULT 'SEPAY',
ADD COLUMN IF NOT EXISTS "transaction_date" TIMESTAMP NOT NULL,
ADD COLUMN IF NOT EXISTS "account_number" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "sub_account" VARCHAR(250),
ADD COLUMN IF NOT EXISTS "amount_in" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "amount_out" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "accumulated" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "code" VARCHAR(250),
ADD COLUMN IF NOT EXISTS "transaction_content" TEXT,
ADD COLUMN IF NOT EXISTS "reference_number" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "body" TEXT;

-- Drop old PayOS columns if they exist
ALTER TABLE "payment_transactions" 
DROP COLUMN IF EXISTS "checkout_url",
DROP COLUMN IF EXISTS "counter_account_bank_id",
DROP COLUMN IF EXISTS "counter_account_bank_name",
DROP COLUMN IF EXISTS "counter_account_name",
DROP COLUMN IF EXISTS "counter_account_number",
DROP COLUMN IF EXISTS "payment_link_id",
DROP COLUMN IF EXISTS "qr_code",
DROP COLUMN IF EXISTS "virtual_account_name",
DROP COLUMN IF EXISTS "virtual_account_number",
DROP COLUMN IF EXISTS "reference",
DROP COLUMN IF EXISTS "order_code",
DROP COLUMN IF EXISTS "amount",
DROP COLUMN IF EXISTS "description",
DROP COLUMN IF EXISTS "transaction_datetime";

-- Update status default
ALTER TABLE "payment_transactions" 
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Remove gateway default after initial setup
ALTER TABLE "payment_transactions" 
ALTER COLUMN "gateway" DROP DEFAULT;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS "payment_transactions_status_created_at_idx";
DROP INDEX IF EXISTS "payment_transactions_reference_idx";
DROP INDEX IF EXISTS "payment_transactions_counter_account_number_idx";

-- Create new indexes
CREATE INDEX IF NOT EXISTS "payment_transactions_reference_number_idx" ON "payment_transactions"("reference_number");
CREATE INDEX IF NOT EXISTS "payment_transactions_transaction_date_idx" ON "payment_transactions"("transaction_date");
CREATE INDEX IF NOT EXISTS "payment_transactions_gateway_idx" ON "payment_transactions"("gateway");

-- Add unique constraint on reference_number
ALTER TABLE "payment_transactions" 
ADD CONSTRAINT "payment_transactions_reference_number_key" UNIQUE ("reference_number");
