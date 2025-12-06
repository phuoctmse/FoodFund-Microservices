-- AlterTable
ALTER TABLE "public"."delivery_staff_profiles" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "public"."kitchen_staff_profiles" ADD COLUMN     "organization_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."kitchen_staff_profiles" ADD CONSTRAINT "kitchen_staff_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_staff_profiles" ADD CONSTRAINT "delivery_staff_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
