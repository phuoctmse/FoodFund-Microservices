-- AlterTable
ALTER TABLE "ingredient_requests" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "operation_requests" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "ingredient_requests_organization_id_idx" ON "ingredient_requests"("organization_id");

-- CreateIndex
CREATE INDEX "ingredient_requests_organization_id_status_idx" ON "ingredient_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "operation_requests_organization_id_idx" ON "operation_requests"("organization_id");

-- CreateIndex
CREATE INDEX "operation_requests_organization_id_status_idx" ON "operation_requests"("organization_id", "status");
