/*
  Warnings:

  - You are about to drop the column `is_active` on the `donor_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."donor_profiles" DROP COLUMN "is_active";
