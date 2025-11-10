import { registerEnumType } from "@nestjs/graphql"

// Webhook processing result
export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
}

registerEnumType(TransactionStatus, {
    name: "TransactionStatus",
    description: "Trạng thái xử lý webhook của giao dịch thanh toán",
    valuesMap: {
        PENDING: {
            description:
                "Chưa nhận webhook hoặc đang chờ xử lý từ cổng thanh toán",
        },
        SUCCESS: {
            description: "Webhook đã xử lý thành công, giao dịch hoàn tất",
        },
        FAILED: {
            description:
                "Webhook báo lỗi hoặc giao dịch thất bại",
        },
        REFUNDED: {
            description: "Giao dịch đã được hoàn tiền",
        },
    },
})

// Amount received tracking
export enum PaymentAmountStatus {
    PENDING = "PENDING",
    PARTIAL = "PARTIAL",
    COMPLETED = "COMPLETED",
    OVERPAID = "OVERPAID",
}

registerEnumType(PaymentAmountStatus, {
    name: "PaymentAmountStatus",
    description: "Trạng thái số tiền thực tế nhận được so với số tiền yêu cầu",
    valuesMap: {
        PENDING: {
            description: "Chưa nhận tiền (received_amount = 0)",
        },
        PARTIAL: {
            description: "Nhận thiếu (received_amount < amount)",
        },
        COMPLETED: {
            description: "Nhận đủ (received_amount = amount)",
        },
        OVERPAID: {
            description: "Nhận thừa (received_amount > amount)",
        },
    },
})

// Deprecated - For backward compatibility
export const PaymentStatus = TransactionStatus

