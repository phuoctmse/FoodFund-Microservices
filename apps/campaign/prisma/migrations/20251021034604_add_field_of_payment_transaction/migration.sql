-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "account_bank_name" VARCHAR(255),
ADD COLUMN     "transaction_datetime" TIMESTAMP(3);
