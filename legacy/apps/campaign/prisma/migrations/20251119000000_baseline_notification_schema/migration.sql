DROP INDEX IF EXISTS "notifications_entity_type_entity_id_idx";
DROP INDEX IF EXISTS "notifications_type_created_at_idx";
DROP INDEX IF EXISTS "notifications_user_id_created_at_idx";
DROP INDEX IF EXISTS "notifications_user_id_is_read_created_at_idx";
DROP INDEX IF EXISTS "notifications_user_id_entity_type_entity_id_type_created_at_key";

-- Create new optimized indexes
CREATE INDEX IF NOT EXISTS "idx_user_timeline" 
  ON "notifications"("user_id", "created_at", "id");

CREATE INDEX IF NOT EXISTS "idx_entity_lookup" 
  ON "notifications"("entity_type", "entity_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_user_unread_recent" 
  ON "notifications"("user_id", "is_read", "created_at");

CREATE INDEX IF NOT EXISTS "idx_type_recent" 
  ON "notifications"("type", "created_at");

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_notification_event" 
  ON "notifications"("user_id", "entity_type", "entity_id", "type", "created_at");

-- Update data column default
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
      AND column_name = 'data'
  ) THEN
    ALTER TABLE "notifications" 
      ALTER COLUMN "data" SET DEFAULT '{}';
  END IF;
END $$;