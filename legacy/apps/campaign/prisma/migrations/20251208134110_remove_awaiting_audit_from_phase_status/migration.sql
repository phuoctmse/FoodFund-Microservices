/*
  Warnings:

  - The values [AWAITING_AUDIT] on the enum `Campaign_Phase_Status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Campaign_Phase_Status_new" AS ENUM ('PLANNING', 'AWAITING_INGREDIENT_DISBURSEMENT', 'INGREDIENT_PURCHASE', 'AWAITING_COOKING_DISBURSEMENT', 'COOKING', 'AWAITING_DELIVERY_DISBURSEMENT', 'DELIVERY', 'COMPLETED', 'CANCELLED', 'FAILED');
ALTER TABLE "public"."campaign_phases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "campaign_phases" ALTER COLUMN "status" TYPE "Campaign_Phase_Status_new" USING ("status"::text::"Campaign_Phase_Status_new");
ALTER TYPE "Campaign_Phase_Status" RENAME TO "Campaign_Phase_Status_old";
ALTER TYPE "Campaign_Phase_Status_new" RENAME TO "Campaign_Phase_Status";
DROP TYPE "public"."Campaign_Phase_Status_old";
ALTER TABLE "campaign_phases" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;
