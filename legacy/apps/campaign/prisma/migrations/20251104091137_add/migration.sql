/*
  Warnings:

  - The values [AWAITING_DISBURSEMENT,FUNDS_DISBURSED,INGREDIENT_PURCHASE,COOKING,DELIVERY] on the enum `Campaign_Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `approved_at` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `cooking_date` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `delivery_date` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `donation_count` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `ingredient_purchase_date` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `campaigns` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Campaign_Phase_Status" AS ENUM ('PLANNING', 'AWAITING_INGREDIENT_DISBURSEMENT', 'INGREDIENT_PURCHASE', 'AWAITING_AUDIT', 'AWAITING_COOKING_DISBURSEMENT', 'COOKING', 'AWAITING_DELIVERY_DISBURSEMENT', 'DELIVERY', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "Campaign_Status_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'PROCESSING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."campaigns" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "campaigns" ALTER COLUMN "status" TYPE "Campaign_Status_new" USING ("status"::text::"Campaign_Status_new");
ALTER TYPE "Campaign_Status" RENAME TO "Campaign_Status_old";
ALTER TYPE "Campaign_Status_new" RENAME TO "Campaign_Status";
DROP TYPE "public"."Campaign_Status_old";
ALTER TABLE "campaigns" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "approved_at",
DROP COLUMN "cooking_date",
DROP COLUMN "delivery_date",
DROP COLUMN "donation_count",
DROP COLUMN "ingredient_purchase_date",
DROP COLUMN "location",
ADD COLUMN     "changed_status_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "campaign_phases" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "phase_name" VARCHAR(100) NOT NULL,
    "location" TEXT NOT NULL,
    "ingredient_purchase_date" TIMESTAMP(3) NOT NULL,
    "cooking_date" TIMESTAMP(3) NOT NULL,
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "status" "Campaign_Phase_Status" NOT NULL DEFAULT 'PLANNING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_phases_campaign_id_idx" ON "campaign_phases"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_phases_status_idx" ON "campaign_phases"("status");

-- CreateIndex
CREATE INDEX "campaign_phases_created_at_idx" ON "campaign_phases"("created_at");

-- CreateIndex
CREATE INDEX "campaign_phases_campaign_id_status_idx" ON "campaign_phases"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_phases_ingredient_purchase_date_idx" ON "campaign_phases"("ingredient_purchase_date");

-- CreateIndex
CREATE INDEX "campaign_phases_cooking_date_idx" ON "campaign_phases"("cooking_date");

-- CreateIndex
CREATE INDEX "campaign_phases_delivery_date_idx" ON "campaign_phases"("delivery_date");

-- CreateIndex
CREATE INDEX "campaigns_changed_status_at_idx" ON "campaigns"("changed_status_at");

-- CreateIndex
CREATE INDEX "campaigns_status_changed_status_at_idx" ON "campaigns"("status", "changed_status_at");

-- AddForeignKey
ALTER TABLE "campaign_phases" ADD CONSTRAINT "campaign_phases_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
