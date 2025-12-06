-- AlterTable: payment_transactions - Add gateway tracking fields
ALTER TABLE "payment_transactions" 
  ADD COLUMN "gateway" VARCHAR(50),
  ADD COLUMN "processed_by_webhook" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sepay_reference_number" VARCHAR(255),
  ADD COLUMN "sepay_transaction_id" INTEGER,
  ADD COLUMN "is_matched" BOOLEAN NOT NULL DEFAULT false;

-- Update existing records to set gateway = 'PAYOS' 
UPDATE "payment_transactions" 
SET "gateway" = 'PAYOS',
    "processed_by_webhook" = CASE 
      WHEN "status" = 'SUCCESS' THEN true 
      ELSE false 
    END,
    "is_matched" = CASE 
      WHEN "status" = 'SUCCESS' THEN true 
      ELSE false 
    END
WHERE "gateway" IS NULL;

-- CreateIndex: payment_transactions
CREATE INDEX "payment_transactions_gateway_idx" ON "payment_transactions"("gateway");
CREATE INDEX "payment_transactions_processed_by_webhook_idx" ON "payment_transactions"("processed_by_webhook");
CREATE INDEX "payment_transactions_sepay_transaction_id_idx" ON "payment_transactions"("sepay_transaction_id");
CREATE INDEX "payment_transactions_is_matched_idx" ON "payment_transactions"("is_matched");
CREATE INDEX "payment_transactions_status_gateway_idx" ON "payment_transactions"("status", "gateway");
