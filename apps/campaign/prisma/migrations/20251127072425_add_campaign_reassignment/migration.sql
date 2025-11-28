-- CreateEnum
CREATE TYPE "Reassignment_Status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "previous_status" "Campaign_Status";

-- CreateTable
CREATE TABLE "campaign_reassignments" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "Reassignment_Status" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "response_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_reassignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_reassignments_campaign_id_idx" ON "campaign_reassignments"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_reassignments_organization_id_idx" ON "campaign_reassignments"("organization_id");

-- CreateIndex
CREATE INDEX "campaign_reassignments_status_idx" ON "campaign_reassignments"("status");

-- CreateIndex
CREATE INDEX "campaign_reassignments_expires_at_idx" ON "campaign_reassignments"("expires_at");

-- CreateIndex
CREATE INDEX "campaign_reassignments_organization_id_status_idx" ON "campaign_reassignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "campaign_reassignments_campaign_id_status_idx" ON "campaign_reassignments"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_reassignments_campaign_id_organization_id_key" ON "campaign_reassignments"("campaign_id", "organization_id");

-- AddForeignKey
ALTER TABLE "campaign_reassignments" ADD CONSTRAINT "campaign_reassignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
