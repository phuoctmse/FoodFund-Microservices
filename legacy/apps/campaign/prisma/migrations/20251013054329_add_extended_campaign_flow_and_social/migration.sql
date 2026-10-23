/*
  Warnings:

  - You are about to drop the column `end_date` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `cooking_budget_percentage` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cooking_date` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delivery_budget_percentage` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delivery_date` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundraising_end_date` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fundraising_start_date` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredient_budget_percentage` to the `campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredient_purchase_date` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Payment_Status" AS ENUM ('SUCCESS', 'FAILED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Campaign_Status" ADD VALUE 'AWAITING_DISBURSEMENT';
ALTER TYPE "Campaign_Status" ADD VALUE 'FUNDS_DISBURSED';
ALTER TYPE "Campaign_Status" ADD VALUE 'INGREDIENT_PURCHASE';
ALTER TYPE "Campaign_Status" ADD VALUE 'COOKING';
ALTER TYPE "Campaign_Status" ADD VALUE 'DELIVERY';

-- DropIndex
DROP INDEX "public"."campaigns_start_date_end_date_idx";

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "end_date",
DROP COLUMN "start_date",
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "cooking_budget_percentage" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "cooking_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "delivery_budget_percentage" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "delivery_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fundraising_end_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fundraising_start_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "ingredient_budget_percentage" DECIMAL(5,2) NOT NULL,
ADD COLUMN     "ingredient_purchase_date" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "donation_id" TEXT NOT NULL,
    "order_code" BIGINT NOT NULL,
    "bin" VARCHAR(20),
    "account_number" VARCHAR(50),
    "account_name" VARCHAR(255),
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'VND',
    "description" TEXT,
    "payment_link_id" TEXT,
    "checkout_url" TEXT,
    "qr_code" TEXT,
    "status" "Payment_Status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "refunded_at" TIMESTAMP(3),

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "media" JSONB,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "comment_path" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_transactions_donation_id_idx" ON "payment_transactions"("donation_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_status_created_at_idx" ON "payment_transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_order_code_key" ON "payment_transactions"("order_code");

-- CreateIndex
CREATE INDEX "posts_campaign_id_idx" ON "posts"("campaign_id");

-- CreateIndex
CREATE INDEX "posts_created_by_idx" ON "posts"("created_by");

-- CreateIndex
CREATE INDEX "posts_is_active_idx" ON "posts"("is_active");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_campaign_id_is_active_created_at_idx" ON "posts"("campaign_id", "is_active", "created_at");

-- CreateIndex
CREATE INDEX "posts_like_count_idx" ON "posts"("like_count");

-- CreateIndex
CREATE INDEX "post_likes_post_id_idx" ON "post_likes"("post_id");

-- CreateIndex
CREATE INDEX "post_likes_user_id_idx" ON "post_likes"("user_id");

-- CreateIndex
CREATE INDEX "post_likes_created_at_idx" ON "post_likes"("created_at");

-- CreateIndex
CREATE INDEX "post_likes_post_id_created_at_idx" ON "post_likes"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_post_id_user_id_key" ON "post_likes"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "post_comments_post_id_idx" ON "post_comments"("post_id");

-- CreateIndex
CREATE INDEX "post_comments_user_id_idx" ON "post_comments"("user_id");

-- CreateIndex
CREATE INDEX "post_comments_parent_comment_id_idx" ON "post_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "post_comments_created_at_idx" ON "post_comments"("created_at");

-- CreateIndex
CREATE INDEX "post_comments_post_id_parent_comment_id_created_at_idx" ON "post_comments"("post_id", "parent_comment_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comments_comment_path_idx" ON "post_comments"("comment_path");

-- CreateIndex
CREATE INDEX "post_comments_depth_idx" ON "post_comments"("depth");

-- CreateIndex
CREATE INDEX "campaigns_fundraising_start_date_fundraising_end_date_idx" ON "campaigns"("fundraising_start_date", "fundraising_end_date");

-- CreateIndex
CREATE INDEX "campaigns_status_fundraising_end_date_idx" ON "campaigns"("status", "fundraising_end_date");

-- CreateIndex
CREATE INDEX "donations_created_at_idx" ON "donations"("created_at");

-- CreateIndex
CREATE INDEX "donations_campaign_id_created_at_idx" ON "donations"("campaign_id", "created_at");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
