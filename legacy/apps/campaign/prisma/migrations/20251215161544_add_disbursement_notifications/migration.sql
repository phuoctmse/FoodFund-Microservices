-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Notification_Type" ADD VALUE 'INGREDIENT_DISBURSEMENT_COMPLETED';
ALTER TYPE "Notification_Type" ADD VALUE 'COOKING_DISBURSEMENT_COMPLETED';
ALTER TYPE "Notification_Type" ADD VALUE 'DELIVERY_DISBURSEMENT_COMPLETED';
ALTER TYPE "Notification_Type" ADD VALUE 'CAMPAIGN_REASSIGNMENT_PENDING';
ALTER TYPE "Notification_Type" ADD VALUE 'CAMPAIGN_OWNERSHIP_TRANSFERRED';
ALTER TYPE "Notification_Type" ADD VALUE 'CAMPAIGN_OWNERSHIP_RECEIVED';
ALTER TYPE "Notification_Type" ADD VALUE 'CAMPAIGN_REASSIGNMENT_EXPIRED';
