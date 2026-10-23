-- AddForeignKey
ALTER TABLE "inflow_transactions" ADD CONSTRAINT "inflow_transactions_ingredient_request_id_fkey" FOREIGN KEY ("ingredient_request_id") REFERENCES "ingredient_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inflow_transactions" ADD CONSTRAINT "inflow_transactions_operation_request_id_fkey" FOREIGN KEY ("operation_request_id") REFERENCES "operation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
