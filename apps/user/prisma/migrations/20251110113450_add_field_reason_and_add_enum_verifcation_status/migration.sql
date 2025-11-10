-- AlterEnum
ALTER TYPE "Verification_Status" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "reason" TEXT;
