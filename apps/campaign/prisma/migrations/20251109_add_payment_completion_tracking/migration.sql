-- CreateEnum for Payment Completion Status-- Manual migration

CREATE TYPE "Payment_Completion_Status" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'OVERPAID');

-- AlterTable: Add received_amount and payment_status to payment_transactions
ALTER TABLE "payment_transactions" 
ADD COLUMN "received_amount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "payment_status" "Payment_Completion_Status" NOT NULL DEFAULT 'PENDING';

-- Backfill received_amount with amount for existing records
UPDATE "payment_transactions" 
SET "received_amount" = "amount",
    "payment_status" = CASE 
        WHEN "status" = 'SUCCESS' THEN 'COMPLETED'::"Payment_Completion_Status"
        WHEN "status" = 'PENDING' THEN 'PENDING'::"Payment_Completion_Status"
        ELSE 'PENDING'::"Payment_Completion_Status"
    END
WHERE "received_amount" = 0;
