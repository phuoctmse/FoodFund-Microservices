BEGIN;

-- Drop legacy/ambiguous indexes if exist (non-destructive)
DROP INDEX IF EXISTS "idx_notifications_entity";
DROP INDEX IF EXISTS "idx_entity_lookup";
DROP INDEX IF EXISTS "idx_user_timeline";
DROP INDEX IF EXISTS "idx_user_unread_recent";
DROP INDEX IF EXISTS "idx_type_recent";
DROP INDEX IF EXISTS "idx_notifications_cursor";

-- Create indexes expected by schema.prisma (safe: IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_user_timeline"
  ON "notifications" ("user_id", "created_at", "id");

CREATE INDEX IF NOT EXISTS "idx_entity_lookup"
  ON "notifications" ("entity_type", "entity_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_user_unread_recent"
  ON "notifications" ("user_id", "is_read", "created_at");

CREATE INDEX IF NOT EXISTS "idx_type_recent"
  ON "notifications" ("type", "created_at");

-- Cursor index with ordering to match app pagination patterns
CREATE INDEX IF NOT EXISTS "idx_notifications_cursor"
  ON "notifications" ("user_id", "created_at" DESC, "id" DESC);

-- Keep the entity->created index (schema defines two similar names; ensure present)
CREATE INDEX IF NOT EXISTS "idx_notifications_entity"
  ON "notifications" ("entity_type", "entity_id", "created_at");

COMMIT;