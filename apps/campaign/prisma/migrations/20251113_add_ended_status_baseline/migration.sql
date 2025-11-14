-- AlterEnum: Add ENDED status to Campaign_Status enum
-- Purpose: Mark campaigns that ended with < 50% funding
-- These campaigns have funds pooled to fundraiser wallet for other campaigns

ALTER TYPE "Campaign_Status" ADD VALUE IF NOT EXISTS 'ENDED';
