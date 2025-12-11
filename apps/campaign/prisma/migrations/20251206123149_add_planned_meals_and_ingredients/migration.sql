-- CreateTable
CREATE TABLE "planned_meals" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_ingredients" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planned_meals_campaign_phase_id_idx" ON "planned_meals"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "planned_ingredients_campaign_phase_id_idx" ON "planned_ingredients"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "planned_ingredients_name_idx" ON "planned_ingredients"("name");

-- AddForeignKey
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_campaign_phase_id_fkey" FOREIGN KEY ("campaign_phase_id") REFERENCES "campaign_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_ingredients" ADD CONSTRAINT "planned_ingredients_campaign_phase_id_fkey" FOREIGN KEY ("campaign_phase_id") REFERENCES "campaign_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
