/*
  Warnings:

  - You are about to drop the column `checkout_url` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `counter_account_bank_id` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `payment_link_id` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `qr_code` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `virtual_account_name` on the `payment_transactions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."payment_transactions_status_created_at_idx";

-- AlterTable
ALTER TABLE "payment_transactions" DROP COLUMN "checkout_url",
DROP COLUMN "counter_account_bank_id",
DROP COLUMN "payment_link_id",
DROP COLUMN "qr_code",
DROP COLUMN "virtual_account_name",
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "gateway" DROP DEFAULT,
ALTER COLUMN "transaction_date" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "payment_transactions_reference_number_idx" ON "payment_transactions"("reference_number");
