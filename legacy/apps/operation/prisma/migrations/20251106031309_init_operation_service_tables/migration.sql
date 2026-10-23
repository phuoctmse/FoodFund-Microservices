-- CreateEnum
CREATE TYPE "Ingredient_Request_Status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "Expense_Proof_Status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Operation_Request_Status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "Operation_Expense_Type" AS ENUM ('COOKING', 'DELIVERY');

-- CreateEnum
CREATE TYPE "Meal_Batch_Status" AS ENUM ('PREPARING', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "Delivery_Task_Status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'OUT_FOR_DELIVERY', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Inflow_Transaction_Type" AS ENUM ('INGREDIENT', 'COOKING', 'DELIVERY');

-- CreateEnum
CREATE TYPE "Inflow_Transaction_Status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ingredient_requests" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "kitchen_staff_id" TEXT NOT NULL,
    "total_cost" BIGINT NOT NULL DEFAULT 0,
    "status" "Ingredient_Request_Status" NOT NULL DEFAULT 'PENDING',
    "changed_status_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_request_items" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "ingredient_name" VARCHAR(100) NOT NULL,
    "quantity" VARCHAR(50) NOT NULL,
    "estimated_unit_price" INTEGER NOT NULL DEFAULT 0,
    "estimated_total_price" INTEGER NOT NULL DEFAULT 0,
    "supplier" VARCHAR(200),

    CONSTRAINT "ingredient_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_proofs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "media" JSONB NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "status" "Expense_Proof_Status" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "changed_status_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_requests" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "total_cost" BIGINT NOT NULL DEFAULT 0,
    "expense_type" "Operation_Expense_Type" NOT NULL,
    "status" "Operation_Request_Status" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "changed_status_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_batches" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "kitchen_staff_id" TEXT NOT NULL,
    "food_name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "media" JSONB,
    "status" "Meal_Batch_Status" NOT NULL DEFAULT 'PREPARING',
    "cooked_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_batch_ingredient_usages" (
    "id" TEXT NOT NULL,
    "meal_batch_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,

    CONSTRAINT "meal_batch_ingredient_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tasks" (
    "id" TEXT NOT NULL,
    "delivery_staff_id" TEXT NOT NULL,
    "meal_batch_id" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "status" "Delivery_Task_Status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_status_logs" (
    "id" TEXT NOT NULL,
    "delivery_task_id" TEXT NOT NULL,
    "status" "Delivery_Task_Status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inflow_transactions" (
    "id" TEXT NOT NULL,
    "campaign_phase_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "transaction_type" "Inflow_Transaction_Type" NOT NULL,
    "proof" TEXT,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "status" "Inflow_Transaction_Status" NOT NULL DEFAULT 'PENDING',
    "is_reported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reported_at" TIMESTAMP(3),

    CONSTRAINT "inflow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingredient_requests_campaign_phase_id_idx" ON "ingredient_requests"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "ingredient_requests_kitchen_staff_id_idx" ON "ingredient_requests"("kitchen_staff_id");

-- CreateIndex
CREATE INDEX "ingredient_requests_status_idx" ON "ingredient_requests"("status");

-- CreateIndex
CREATE INDEX "ingredient_requests_created_at_idx" ON "ingredient_requests"("created_at");

-- CreateIndex
CREATE INDEX "ingredient_requests_campaign_phase_id_status_idx" ON "ingredient_requests"("campaign_phase_id", "status");

-- CreateIndex
CREATE INDEX "ingredient_request_items_request_id_idx" ON "ingredient_request_items"("request_id");

-- CreateIndex
CREATE INDEX "ingredient_request_items_ingredient_name_idx" ON "ingredient_request_items"("ingredient_name");

-- CreateIndex
CREATE INDEX "expense_proofs_request_id_idx" ON "expense_proofs"("request_id");

-- CreateIndex
CREATE INDEX "expense_proofs_status_idx" ON "expense_proofs"("status");

-- CreateIndex
CREATE INDEX "expense_proofs_created_at_idx" ON "expense_proofs"("created_at");

-- CreateIndex
CREATE INDEX "expense_proofs_request_id_status_idx" ON "expense_proofs"("request_id", "status");

-- CreateIndex
CREATE INDEX "operation_requests_campaign_phase_id_idx" ON "operation_requests"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "operation_requests_user_id_idx" ON "operation_requests"("user_id");

-- CreateIndex
CREATE INDEX "operation_requests_expense_type_idx" ON "operation_requests"("expense_type");

-- CreateIndex
CREATE INDEX "operation_requests_status_idx" ON "operation_requests"("status");

-- CreateIndex
CREATE INDEX "operation_requests_created_at_idx" ON "operation_requests"("created_at");

-- CreateIndex
CREATE INDEX "operation_requests_campaign_phase_id_expense_type_status_idx" ON "operation_requests"("campaign_phase_id", "expense_type", "status");

-- CreateIndex
CREATE INDEX "meal_batches_campaign_phase_id_idx" ON "meal_batches"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "meal_batches_kitchen_staff_id_idx" ON "meal_batches"("kitchen_staff_id");

-- CreateIndex
CREATE INDEX "meal_batches_status_idx" ON "meal_batches"("status");

-- CreateIndex
CREATE INDEX "meal_batches_cooked_date_idx" ON "meal_batches"("cooked_date");

-- CreateIndex
CREATE INDEX "meal_batches_campaign_phase_id_status_idx" ON "meal_batches"("campaign_phase_id", "status");

-- CreateIndex
CREATE INDEX "meal_batch_ingredient_usages_meal_batch_id_idx" ON "meal_batch_ingredient_usages"("meal_batch_id");

-- CreateIndex
CREATE INDEX "meal_batch_ingredient_usages_ingredient_id_idx" ON "meal_batch_ingredient_usages"("ingredient_id");

-- CreateIndex
CREATE INDEX "delivery_tasks_delivery_staff_id_idx" ON "delivery_tasks"("delivery_staff_id");

-- CreateIndex
CREATE INDEX "delivery_tasks_meal_batch_id_idx" ON "delivery_tasks"("meal_batch_id");

-- CreateIndex
CREATE INDEX "delivery_tasks_status_idx" ON "delivery_tasks"("status");

-- CreateIndex
CREATE INDEX "delivery_tasks_created_at_idx" ON "delivery_tasks"("created_at");

-- CreateIndex
CREATE INDEX "delivery_tasks_delivery_staff_id_status_idx" ON "delivery_tasks"("delivery_staff_id", "status");

-- CreateIndex
CREATE INDEX "delivery_status_logs_delivery_task_id_idx" ON "delivery_status_logs"("delivery_task_id");

-- CreateIndex
CREATE INDEX "delivery_status_logs_status_idx" ON "delivery_status_logs"("status");

-- CreateIndex
CREATE INDEX "delivery_status_logs_created_at_idx" ON "delivery_status_logs"("created_at");

-- CreateIndex
CREATE INDEX "delivery_status_logs_delivery_task_id_created_at_idx" ON "delivery_status_logs"("delivery_task_id", "created_at");

-- CreateIndex
CREATE INDEX "inflow_transactions_campaign_phase_id_idx" ON "inflow_transactions"("campaign_phase_id");

-- CreateIndex
CREATE INDEX "inflow_transactions_receiver_id_idx" ON "inflow_transactions"("receiver_id");

-- CreateIndex
CREATE INDEX "inflow_transactions_transaction_type_idx" ON "inflow_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "inflow_transactions_status_idx" ON "inflow_transactions"("status");

-- CreateIndex
CREATE INDEX "inflow_transactions_is_reported_idx" ON "inflow_transactions"("is_reported");

-- CreateIndex
CREATE INDEX "inflow_transactions_created_at_idx" ON "inflow_transactions"("created_at");

-- CreateIndex
CREATE INDEX "inflow_transactions_campaign_phase_id_transaction_type_stat_idx" ON "inflow_transactions"("campaign_phase_id", "transaction_type", "status");

-- AddForeignKey
ALTER TABLE "ingredient_request_items" ADD CONSTRAINT "ingredient_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ingredient_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_proofs" ADD CONSTRAINT "expense_proofs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ingredient_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_batch_ingredient_usages" ADD CONSTRAINT "meal_batch_ingredient_usages_meal_batch_id_fkey" FOREIGN KEY ("meal_batch_id") REFERENCES "meal_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_batch_ingredient_usages" ADD CONSTRAINT "meal_batch_ingredient_usages_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_meal_batch_id_fkey" FOREIGN KEY ("meal_batch_id") REFERENCES "meal_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_logs" ADD CONSTRAINT "delivery_status_logs_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
