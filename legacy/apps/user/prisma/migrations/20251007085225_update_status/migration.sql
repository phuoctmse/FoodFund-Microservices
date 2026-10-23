/*
  Warnings:

  - You are about to drop the column `verification_status` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."Verification_Status" ADD VALUE 'INACTIVE';

-- AlterTable
ALTER TABLE "public"."organizations" DROP COLUMN "verification_status",
ADD COLUMN     "status" "public"."Verification_Status" NOT NULL DEFAULT 'PENDING';
