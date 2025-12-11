-- Step 1: Add new 'unit' column with default value first
ALTER TABLE "ingredient_request_items" ADD COLUMN "unit" VARCHAR(50) DEFAULT 'unit';

-- Step 2: Add new 'planned_ingredient_id' column (nullable)
ALTER TABLE "ingredient_request_items" ADD COLUMN "planned_ingredient_id" TEXT;

-- Step 3: Parse existing quantity string to extract unit
-- Example: "30kg" -> unit = "kg", "5 gói" -> unit = "gói"
-- This handles common patterns in Vietnamese
UPDATE "ingredient_request_items"
SET unit = CASE
    -- Extract unit after number (e.g., "30kg" -> "kg", "5.5 kg" -> "kg")
    WHEN quantity ~ '^[0-9]+\.?[0-9]*\s*[a-zA-ZÀ-ỹ]+' THEN
        TRIM(REGEXP_REPLACE(quantity, '^[0-9]+\.?[0-9]*\s*', ''))
    -- If just a number, default to 'unit'
    WHEN quantity ~ '^[0-9]+\.?[0-9]*$' THEN 'unit'
    -- Otherwise keep default
    ELSE 'unit'
END
WHERE quantity IS NOT NULL;

-- Step 4: Create temporary column for new integer quantity
ALTER TABLE "ingredient_request_items" ADD COLUMN "quantity_int" INTEGER DEFAULT 0;

-- Step 5: Parse quantity string to integer
-- Extract numeric part from strings like "30kg", "5.5 lít", "100"
UPDATE "ingredient_request_items"
SET quantity_int = CASE
    -- Extract leading number (integer part only)
    WHEN quantity ~ '^[0-9]+' THEN
        CAST(REGEXP_REPLACE(quantity, '[^0-9].*$', '') AS INTEGER)
    ELSE 0
END
WHERE quantity IS NOT NULL;

-- Step 6: Drop old quantity column
ALTER TABLE "ingredient_request_items" DROP COLUMN "quantity";

-- Step 7: Rename new column to quantity
ALTER TABLE "ingredient_request_items" RENAME COLUMN "quantity_int" TO "quantity";

-- Step 8: Set NOT NULL constraints and defaults
ALTER TABLE "ingredient_request_items" ALTER COLUMN "quantity" SET NOT NULL;
ALTER TABLE "ingredient_request_items" ALTER COLUMN "quantity" SET DEFAULT 0;
ALTER TABLE "ingredient_request_items" ALTER COLUMN "unit" SET NOT NULL;
ALTER TABLE "ingredient_request_items" ALTER COLUMN "unit" DROP DEFAULT;

-- Step 9: Create index for planned_ingredient_id
CREATE INDEX "ingredient_request_items_planned_ingredient_id_idx" ON "ingredient_request_items"("planned_ingredient_id");