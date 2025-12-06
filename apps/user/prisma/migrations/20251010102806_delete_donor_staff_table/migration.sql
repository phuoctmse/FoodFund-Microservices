/*
  Warnings:

  - You are about to drop the `delivery_staff_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `donor_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kitchen_staff_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."delivery_staff_profiles" DROP CONSTRAINT "delivery_staff_profiles_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."delivery_staff_profiles" DROP CONSTRAINT "delivery_staff_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."donor_profiles" DROP CONSTRAINT "donor_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."kitchen_staff_profiles" DROP CONSTRAINT "kitchen_staff_profiles_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."kitchen_staff_profiles" DROP CONSTRAINT "kitchen_staff_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "address" TEXT;

-- DropTable
DROP TABLE "public"."delivery_staff_profiles";

-- DropTable
DROP TABLE "public"."donor_profiles";

-- DropTable
DROP TABLE "public"."kitchen_staff_profiles";
