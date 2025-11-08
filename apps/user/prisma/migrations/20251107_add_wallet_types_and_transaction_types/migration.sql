-- CreateEnum: Wallet_Type (if not exists)
DO $$ BEGIN
  CREATE TYPE "Wallet_Type" AS ENUM ('FUNDRAISER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: Transaction_Type (if not exists)
DO $$ BEGIN
  CREATE TYPE "Transaction_Type" AS ENUM ('DONATION_RECEIVED', 'INCOMING_TRANSFER', 'WITHDRAWAL', 'ADMIN_ADJUSTMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: wallets - Add wallet_type
ALTER TABLE "wallets" ADD COLUMN "wallet_type" "Wallet_Type" NOT NULL DEFAULT 'FUNDRAISER';

-- CreateIndex: wallets
CREATE INDEX "wallets_wallet_type_idx" ON "wallets"("wallet_type");
CREATE INDEX "wallets_user_id_wallet_type_idx" ON "wallets"("user_id", "wallet_type");

-- AlterTable: wallet_transactions - Make campaign_id nullable
ALTER TABLE "wallet_transactions" ALTER COLUMN "campaign_id" DROP NOT NULL;

-- AlterTable: wallet_transactions - Add new columns
ALTER TABLE "wallet_transactions" 
  ADD COLUMN "payment_transaction_id" TEXT,
  ADD COLUMN "transaction_type" "Transaction_Type" NOT NULL DEFAULT 'DONATION_RECEIVED',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "gateway" VARCHAR(50),
  ADD COLUMN "sepay_metadata" JSONB;

-- CreateIndex: wallet_transactions
CREATE UNIQUE INDEX "wallet_transactions_payment_transaction_id_key" ON "wallet_transactions"("payment_transaction_id");
CREATE INDEX "wallet_transactions_payment_transaction_id_idx" ON "wallet_transactions"("payment_transaction_id");
CREATE INDEX "wallet_transactions_transaction_type_idx" ON "wallet_transactions"("transaction_type");
CREATE INDEX "wallet_transactions_wallet_id_transaction_type_idx" ON "wallet_transactions"("wallet_id", "transaction_type");
CREATE INDEX "wallet_transactions_campaign_id_created_at_idx" ON "wallet_transactions"("campaign_id", "created_at");
CREATE INDEX "wallet_transactions_gateway_idx" ON "wallet_transactions"("gateway");
