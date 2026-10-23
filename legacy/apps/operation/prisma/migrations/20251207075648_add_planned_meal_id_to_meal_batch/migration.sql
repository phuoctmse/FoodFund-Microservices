-- AlterTable
ALTER TABLE "meal_batches" ADD COLUMN     "planned_meal_id" TEXT;

-- CreateIndex
CREATE INDEX "meal_batches_planned_meal_id_idx" ON "meal_batches"("planned_meal_id");
