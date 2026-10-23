/*
  Warnings:

  - You are about to drop the column `recipient_count` on the `delivery_tasks` table. All the data in the column will be lost.
  - Added the required column `changed_by` to the `delivery_status_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "delivery_status_logs" ADD COLUMN     "changed_by" TEXT NOT NULL,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "delivery_tasks" DROP COLUMN "recipient_count";

-- CreateIndex
CREATE INDEX "delivery_status_logs_changed_by_idx" ON "delivery_status_logs"("changed_by");
