-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Notification_Type" ADD VALUE 'COOKING_REQUEST_APPROVED';
ALTER TYPE "Notification_Type" ADD VALUE 'COOKING_REQUEST_REJECTED';
ALTER TYPE "Notification_Type" ADD VALUE 'DELIVERY_REQUEST_APPROVED';
ALTER TYPE "Notification_Type" ADD VALUE 'DELIVERY_REQUEST_REJECTED';
