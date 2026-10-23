-- AlterTable: Remove unique constraint from payment_transaction_id
ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_payment_transaction_id_key";

-- AlterTable: Add related_payment_id for linking supplement transactions
ALTER TABLE "wallet_transactions" 
ADD COLUMN "related_payment_id" TEXT;

-- CreateIndex for related_payment_id
CREATE INDEX "wallet_transactions_related_payment_id_idx" ON "wallet_transactions"("related_payment_id");
