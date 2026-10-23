-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('DONOR', 'FUNDRAISER', 'KITCHEN_STAFF', 'DELIVERY_STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Verification_Status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."Availability_Status" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar_url" VARCHAR(255) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'DONOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_name" VARCHAR(20) NOT NULL,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."donor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "donation_count" INTEGER NOT NULL DEFAULT 0,
    "total_donated" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kitchen_staff_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_batch_prepared" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_staff_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "availability_status" "public"."Availability_Status" NOT NULL DEFAULT 'AVAILABLE',
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fundraiser_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "organization_address" TEXT,
    "verification_status" "public"."Verification_Status" NOT NULL DEFAULT 'PENDING',
    "total_campaign_created" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "public"."users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_name_key" ON "public"."users"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "donor_profiles_user_id_key" ON "public"."donor_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_staff_profiles_user_id_key" ON "public"."kitchen_staff_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_staff_profiles_user_id_key" ON "public"."delivery_staff_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_profiles_user_id_key" ON "public"."fundraiser_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "public"."donor_profiles" ADD CONSTRAINT "donor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kitchen_staff_profiles" ADD CONSTRAINT "kitchen_staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_staff_profiles" ADD CONSTRAINT "delivery_staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fundraiser_profiles" ADD CONSTRAINT "fundraiser_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
