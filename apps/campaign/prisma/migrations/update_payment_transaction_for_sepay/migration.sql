-- AlterTable: Update Payment_Transaction for Sepay compatibility
-- Drop old columns
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "order_code";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "reference";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "transaction_datetime";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "virtual_account_number";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "counter_account_bank_name";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "counter_account_name";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "counter_account_number";

-- Add Sepay columns
ALTER TABLE "payment_transactions" ADD COLUMN "gateway" VARCHAR(100) NOT NULL DEFAULT 'Unknown';
ALTER TABLE "payment_transactions" ADD COLUMN "transaction_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payment_transactions" ADD COLUMN "account_number" VARCHAR(100);
ALTER TABLE "payment_transactions" ADD COLUMN "sub_account" VARCHAR(250);
ALTER TABLE "payment_transactions" ADD COLUMN "amount_in" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN "amount_out" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN "accumulated" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "payment_transactions" ADD COLUMN "code" VARCHAR(250);
ALTER TABLE "payment_transactions" ADD COLUMN "transaction_content" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN "reference_number" VARCHAR(255);
ALTER TABLE "payment_transactions" ADD COLUMN "body" TEXT;

-- Drop old amount column and use amount_in instead
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "amount";
ALTER TABLE "payment_transactions" DROP COLUMN IF EXISTS "description";

-- Create unique index on reference_number
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_reference_number_key" ON "payment_transactions"("reference_number");

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "payment_transactions_transaction_date_idx" ON "payment_transactions"("transaction_date");
CREATE INDEX IF NOT EXISTS "payment_transactions_gateway_idx" ON "payment_transactions"("gateway");

-- Drop old indexes
DROP INDEX IF EXISTS "payment_transactions_reference_idx";
DROP INDEX IF EXISTS "payment_transactions_order_code_idx";
