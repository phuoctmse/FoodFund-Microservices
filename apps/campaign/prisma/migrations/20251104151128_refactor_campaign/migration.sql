-- AlterTable
ALTER TABLE "campaign_phases" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "extension_count" INTEGER NOT NULL DEFAULT 0;
