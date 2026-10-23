-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "Notification_Type" AS ENUM (
        'CAMPAIGN_APPROVED', 'CAMPAIGN_REJECTED', 'CAMPAIGN_COMPLETED', 'CAMPAIGN_CANCELLED',
        'CAMPAIGN_DONATION_RECEIVED', 'CAMPAIGN_NEW_POST',
        'POST_LIKE', 'POST_COMMENT', 'POST_REPLY',
        'INGREDIENT_REQUEST_APPROVED', 'DELIVERY_TASK_ASSIGNED', 'SYSTEM_ANNOUNCEMENT'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE "Entity_Type" AS ENUM (
        'CAMPAIGN', 'POST', 'COMMENT', 'DONATION', 'INGREDIENT_REQUEST', 'DELIVERY_TASK'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create Base Partitioned Table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "Notification_Type" NOT NULL,
    "entity_type" "Entity_Type" NOT NULL,
    "entity_id" TEXT,
    "data" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- 3. Indexes Strategy
CREATE INDEX IF NOT EXISTS "idx_notifications_cursor"
ON "notifications"("user_id", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_notifications_unread"
ON "notifications"("user_id", "created_at")
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS "idx_notifications_entity"
ON "notifications"("entity_type", "entity_id", "created_at");

-- 4. Create Partitions (Manual for init)
CREATE TABLE IF NOT EXISTS notifications_2025_11 PARTITION OF notifications FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS notifications_2025_12 PARTITION OF notifications FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS notifications_2026_01 PARTITION OF notifications FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 5. Auto-maintenance Functions
CREATE OR REPLACE FUNCTION create_notification_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'notifications_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
    end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF notifications FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;