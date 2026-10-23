-- Drop index on related_payment_id
DROP INDEX IF EXISTS "wallet_transactions_related_payment_id_idx";

-- Drop related_payment_id column
ALTER TABLE "wallet_transactions" DROP COLUMN IF EXISTS "related_payment_id";
