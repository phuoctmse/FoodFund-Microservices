/*
  Warnings:

  - You are about to drop the column `failed_reason` on the `inflow_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inflow_transactions" DROP COLUMN "failed_reason";
