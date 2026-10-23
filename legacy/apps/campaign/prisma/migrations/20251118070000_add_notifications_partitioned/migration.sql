-- 1. Create Enums (if not exist)
DO $$ BEGIN
    CREATE TYPE "Notification_Type" AS ENUM (
        'CAMPAIGN_APPROVED',
        'CAMPAIGN_REJECTED',
        'CAMPAIGN_COMPLETED',
        'CAMPAIGN_CANCELLED',
        'CAMPAIGN_DONATION_RECEIVED',
        'CAMPAIGN_NEW_POST',
        'POST_LIKE',
        'POST_COMMENT',
        'POST_REPLY',
        'INGREDIENT_REQUEST_APPROVED',
        'DELIVERY_TASK_ASSIGNED',
        'SYSTEM_ANNOUNCEMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Entity_Type" AS ENUM (
        'CAMPAIGN',
        'POST',
        'COMMENT',
        'DONATION',
        'INGREDIENT_REQUEST',
        'DELIVERY_TASK'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Drop existing table if it exists (clean slate)
DROP TABLE IF EXISTS "notifications" CASCADE;

-- 3. Create Partitioned Table with Composite Primary Key
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" "Notification_Type" NOT NULL,
    "entity_type" "Entity_Type" NOT NULL,
    "entity_id" TEXT,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- 4. Create Indexes
CREATE INDEX "idx_user_unread_recent" 
ON "notifications"("user_id", "is_read", "created_at");

CREATE INDEX "idx_user_timeline" 
ON "notifications"("user_id", "created_at");

CREATE INDEX "idx_entity_lookup" 
ON "notifications"("entity_type", "entity_id");

CREATE INDEX "idx_type_recent" 
ON "notifications"("type", "created_at");

-- 5. Unique Constraint for Deduplication
CREATE UNIQUE INDEX "unique_notification_event" 
ON "notifications"("user_id", "entity_type", "entity_id", "type", "created_at");

-- 6. Create Initial Partitions (3 months)
CREATE TABLE notifications_2025_11 
PARTITION OF notifications 
FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE notifications_2025_12 
PARTITION OF notifications 
FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE notifications_2026_01 
PARTITION OF notifications 
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 7. Auto-maintenance Functions
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
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION drop_old_notification_partitions()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    cutoff_date DATE;
BEGIN
    cutoff_date := DATE_TRUNC('month', NOW() - INTERVAL '12 months');

    FOR partition_name IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'notifications_%'
        AND tablename < 'notifications_' || TO_CHAR(cutoff_date, 'YYYY_MM')
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
        RAISE NOTICE 'Dropped old partition: %', partition_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;