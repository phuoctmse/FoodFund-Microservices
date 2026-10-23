/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `campaigns` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE INDEX "campaigns_slug_idx" ON "campaigns"("slug");
