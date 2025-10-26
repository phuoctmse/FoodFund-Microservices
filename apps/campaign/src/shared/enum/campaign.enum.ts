import { registerEnumType } from "@nestjs/graphql"

export enum PaymentStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
}

registerEnumType(PaymentStatus, {
    name: "PaymentStatus",
    description: "Trạng thái giao dịch thanh toán trong hệ thống",
    valuesMap: {
        PENDING: {
            description:
                "Giao dịch đang chờ xác nhận thanh toán (ví dụ: chờ chuyển khoản, chờ xác nhận từ cổng thanh toán)",
        },
        SUCCESS: {
            description: "Giao dịch đã được thanh toán và xác nhận thành công",
        },
        FAILED: {
            description:
                "Giao dịch thất bại (ví dụ: lỗi thẻ, hủy bỏ giao dịch, hết hạn)",
        },
        REFUNDED: {
            description: "Giao dịch đã được hoàn tiền thành công",
        },
    },
})
