-- AlterTable
ALTER TABLE "users" ADD COLUMN     "donation_count" INTEGER DEFAULT 0,
ADD COLUMN     "last_donation_at" TIMESTAMP(3),
ADD COLUMN     "total_donated" BIGINT DEFAULT 0;
