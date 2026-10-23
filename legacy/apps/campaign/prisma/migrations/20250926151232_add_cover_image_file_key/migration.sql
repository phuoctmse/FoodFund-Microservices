-- AlterTable
ALTER TABLE "public"."campaigns" ADD COLUMN     "cover_image_file_key" TEXT;

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "public"."campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_by_idx" ON "public"."campaigns"("created_by");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "public"."campaigns"("created_at");

-- CreateIndex
CREATE INDEX "campaigns_start_date_end_date_idx" ON "public"."campaigns"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "donations_campaign_id_idx" ON "public"."donations"("campaign_id");

-- CreateIndex
CREATE INDEX "donations_donor_id_idx" ON "public"."donations"("donor_id");
