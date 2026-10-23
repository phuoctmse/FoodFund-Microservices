-- DropIndex
DROP INDEX "wallet_transactions_payment_transaction_id_key";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "bank_account_name" VARCHAR(255),
ADD COLUMN     "bank_account_number" VARCHAR(255),
ADD COLUMN     "bank_name" VARCHAR(50),
ADD COLUMN     "bank_short_name" VARCHAR(50);

-- AlterTable
ALTER TABLE "wallet_transactions" ALTER COLUMN "transaction_type" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_campaign_id_idx" ON "wallet_transactions"("campaign_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");
