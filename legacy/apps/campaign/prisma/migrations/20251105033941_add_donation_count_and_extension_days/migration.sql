-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "donation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extension_days" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "campaigns_donation_count_idx" ON "campaigns"("donation_count");
