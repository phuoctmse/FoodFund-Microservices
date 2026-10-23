-- Add JSONB columns for metadata
ALTER TABLE "payment_transactions" 
ADD COLUMN "payos_metadata" JSONB,
ADD COLUMN "sepay_metadata" JSONB;

-- Migrate existing PayOS data to JSONB
UPDATE "payment_transactions"
SET "payos_metadata" = jsonb_build_object(
    'payment_link_id', "payment_link_id",
    'checkout_url', "checkout_url",
    'qr_code', "qr_code",
    'counter_account_bank_id', "counter_account_bank_id",
    'counter_account_bank_name', "counter_account_bank_name",
    'counter_account_name', "counter_account_name",
    'counter_account_number', "counter_account_number",
    'virtual_account_name', "virtual_account_name",
    'virtual_account_number', "virtual_account_number",
    'reference', "reference",
    'transaction_datetime', "transaction_datetime"
)
WHERE "payment_link_id" IS NOT NULL OR "checkout_url" IS NOT NULL;

-- Migrate existing Sepay data to JSONB
UPDATE "payment_transactions"
SET "sepay_metadata" = jsonb_build_object(
    'sepay_transaction_id', "sepay_transaction_id",
    'sepay_reference_number', "sepay_reference_number",
    'is_matched', "is_matched"
)
WHERE "sepay_transaction_id" IS NOT NULL OR "sepay_reference_number" IS NOT NULL;

-- Drop old columns
ALTER TABLE "payment_transactions"
DROP COLUMN "checkout_url",
DROP COLUMN "qr_code",
DROP COLUMN "payment_link_id",
DROP COLUMN "counter_account_bank_id",
DROP COLUMN "counter_account_bank_name",
DROP COLUMN "counter_account_name",
DROP COLUMN "counter_account_number",
DROP COLUMN "virtual_account_name",
DROP COLUMN "virtual_account_number",
DROP COLUMN "reference",
DROP COLUMN "transaction_datetime",
DROP COLUMN "sepay_reference_number",
DROP COLUMN "sepay_transaction_id",
DROP COLUMN "is_matched";

-- Add index for payment_status
CREATE INDEX "payment_transactions_payment_status_idx" ON "payment_transactions"("payment_status");
