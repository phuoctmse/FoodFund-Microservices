-- Migration to revert back to PayOS payment gateway
-- This migration restores PayOS payment_transactions table structure

-- Drop Sepay-specific indexes
DROP INDEX IF EXISTS "payment_transactions_reference_number_idx";
DROP INDEX IF EXISTS "payment_transactions_transaction_date_idx";
DROP INDEX IF EXISTS "payment_transactions_gateway_idx";

-- Drop unique constraint on reference_number
ALTER TABLE "payment_transactions" 
DROP CONSTRAINT IF EXISTS "payment_transactions_reference_number_key";

-- Drop Sepay columns
ALTER TABLE "payment_transactions" 
DROP COLUMN IF EXISTS "gateway",
DROP COLUMN IF EXISTS "transaction_date",
DROP COLUMN IF EXISTS "account_number",
DROP COLUMN IF EXISTS "sub_account",
DROP COLUMN IF EXISTS "amount_in",
DROP COLUMN IF EXISTS "amount_out",
DROP COLUMN IF EXISTS "accumulated",
DROP COLUMN IF EXISTS "code",
DROP COLUMN IF EXISTS "transaction_content",
DROP COLUMN IF EXISTS "reference_number",
DROP COLUMN IF EXISTS "body";

-- Add back PayOS columns
ALTER TABLE "payment_transactions" 
ADD COLUMN IF NOT EXISTS "order_code" BIGINT,
ADD COLUMN IF NOT EXISTS "amount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "checkout_url" TEXT,
ADD COLUMN IF NOT EXISTS "qr_code" TEXT,
ADD COLUMN IF NOT EXISTS "payment_link_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "counter_account_bank_id" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "counter_account_bank_name" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "counter_account_name" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "counter_account_number" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "virtual_account_name" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "virtual_account_number" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "reference" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "transaction_datetime" TIMESTAMP;

-- Create PayOS indexes
CREATE INDEX IF NOT EXISTS "payment_transactions_order_code_idx" ON "payment_transactions"("order_code");
CREATE INDEX IF NOT EXISTS "payment_transactions_payment_link_id_idx" ON "payment_transactions"("payment_link_id");
CREATE INDEX IF NOT EXISTS "payment_transactions_reference_idx" ON "payment_transactions"("reference");

-- Add unique constraint on order_code
ALTER TABLE "payment_transactions" 
ADD CONSTRAINT "payment_transactions_order_code_key" UNIQUE ("order_code");
