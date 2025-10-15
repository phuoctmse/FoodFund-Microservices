/*
  Warnings:

  - Added the required column `updated_at` to the `post_likes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "post_likes" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
