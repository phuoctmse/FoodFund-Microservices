/*
  Warnings:

  - A unique constraint covering the columns `[cognito_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "cognito_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_id_key" ON "public"."users"("cognito_id");
