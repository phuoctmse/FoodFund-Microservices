/*
  Warnings:

  - You are about to drop the column `payment_reference` on the `donations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "donations" DROP COLUMN "payment_reference";
