/*
  Warnings:

  - The values [DONATION_RECEIVED] on the enum `Transaction_Type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Transaction_Type_new" AS ENUM ('INCOMING_TRANSFER', 'WITHDRAWAL', 'ADMIN_ADJUSTMENT');
ALTER TABLE "wallet_transactions" ALTER COLUMN "transaction_type" TYPE "Transaction_Type_new" USING ("transaction_type"::text::"Transaction_Type_new");
ALTER TYPE "Transaction_Type" RENAME TO "Transaction_Type_old";
ALTER TYPE "Transaction_Type_new" RENAME TO "Transaction_Type";
DROP TYPE "public"."Transaction_Type_old";
COMMIT;
