/*
  Warnings:

  - You are about to drop the column `cooking_budget_percentage` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `delivery_budget_percentage` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `ingredient_budget_percentage` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `cooking_budget_percentage` to the `campaign_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delivery_budget_percentage` to the `campaign_phases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredient_budget_percentage` to the `campaign_phases` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add new columns with default values (temporary)
ALTER TABLE "campaign_phases" 
  ADD COLUMN "ingredient_budget_percentage" DECIMAL(5,2) DEFAULT 60.00,
  ADD COLUMN "cooking_budget_percentage" DECIMAL(5,2) DEFAULT 25.00,
  ADD COLUMN "delivery_budget_percentage" DECIMAL(5,2) DEFAULT 15.00;

-- Step 2: Update existing rows with values from their parent campaigns
UPDATE "campaign_phases" cp
SET 
  ingredient_budget_percentage = COALESCE(
    (SELECT c.ingredient_budget_percentage 
     FROM "campaigns" c 
     WHERE c.id = cp.campaign_id 
     LIMIT 1), 
    60.00
  ),
  cooking_budget_percentage = COALESCE(
    (SELECT c.cooking_budget_percentage 
     FROM "campaigns" c 
     WHERE c.id = cp.campaign_id 
     LIMIT 1), 
    25.00
  ),
  delivery_budget_percentage = COALESCE(
    (SELECT c.delivery_budget_percentage 
     FROM "campaigns" c 
     WHERE c.id = cp.campaign_id 
     LIMIT 1), 
    15.00
  )
WHERE cp.is_active = true;

-- Step 3: Make columns NOT NULL after data migration
ALTER TABLE "campaign_phases" 
  ALTER COLUMN "ingredient_budget_percentage" SET NOT NULL,
  ALTER COLUMN "cooking_budget_percentage" SET NOT NULL,
  ALTER COLUMN "delivery_budget_percentage" SET NOT NULL;

-- Step 4: Remove default values (we only needed them for migration)
ALTER TABLE "campaign_phases" 
  ALTER COLUMN "ingredient_budget_percentage" DROP DEFAULT,
  ALTER COLUMN "cooking_budget_percentage" DROP DEFAULT,
  ALTER COLUMN "delivery_budget_percentage" DROP DEFAULT;

-- Step 5: Drop old columns from campaigns
ALTER TABLE "campaigns" 
  DROP COLUMN IF EXISTS "ingredient_budget_percentage",
  DROP COLUMN IF EXISTS "cooking_budget_percentage",
  DROP COLUMN IF EXISTS "delivery_budget_percentage";
