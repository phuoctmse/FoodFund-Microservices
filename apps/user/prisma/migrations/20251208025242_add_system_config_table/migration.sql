-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "data_type" VARCHAR(20) NOT NULL DEFAULT 'STRING',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);
