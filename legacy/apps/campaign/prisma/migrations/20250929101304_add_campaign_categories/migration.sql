-- AlterTable
ALTER TABLE "public"."campaigns" ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "public"."campaign_categories" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_categories_is_active_idx" ON "public"."campaign_categories"("is_active");

-- CreateIndex
CREATE INDEX "campaign_categories_title_idx" ON "public"."campaign_categories"("title");

-- CreateIndex
CREATE INDEX "campaigns_category_id_idx" ON "public"."campaigns"("category_id");

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."campaign_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
