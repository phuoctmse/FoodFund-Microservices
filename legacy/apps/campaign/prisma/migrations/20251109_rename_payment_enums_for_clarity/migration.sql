-- Rename enum types for better clarity
ALTER TYPE "Payment_Status" RENAME TO "Transaction_Status";
ALTER TYPE "Payment_Completion_Status" RENAME TO "Payment_Amount_Status";
