-- AlterTable
ALTER TABLE "post_comments" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "post_comments_is_active_idx" ON "post_comments"("is_active");

-- CreateIndex
CREATE INDEX "post_comments_post_id_is_active_created_at_idx" ON "post_comments"("post_id", "is_active", "created_at");
