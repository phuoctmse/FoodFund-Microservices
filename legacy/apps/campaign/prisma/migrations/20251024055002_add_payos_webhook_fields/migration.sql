-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "counter_account_bank_id" VARCHAR(20),
ADD COLUMN     "counter_account_bank_name" VARCHAR(255),
ADD COLUMN     "counter_account_name" VARCHAR(255),
ADD COLUMN     "counter_account_number" VARCHAR(50),
ADD COLUMN     "error_code" VARCHAR(50),
ADD COLUMN     "error_description" TEXT,
ADD COLUMN     "reference" VARCHAR(100),
ADD COLUMN     "virtual_account_name" VARCHAR(255),
ADD COLUMN     "virtual_account_number" VARCHAR(50);

-- CreateIndex
CREATE INDEX "payment_transactions_reference_idx" ON "payment_transactions"("reference");

-- CreateIndex
CREATE INDEX "payment_transactions_counter_account_number_idx" ON "payment_transactions"("counter_account_number");
