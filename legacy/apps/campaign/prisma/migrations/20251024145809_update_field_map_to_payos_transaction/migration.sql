/*
  Warnings:

  - You are about to drop the column `account_bank_name` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `account_name` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `account_number` on the `payment_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `bin` on the `payment_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_transactions" DROP COLUMN "account_bank_name",
DROP COLUMN "account_name",
DROP COLUMN "account_number",
DROP COLUMN "bin";
