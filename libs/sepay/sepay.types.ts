/**
 * Sepay API Types
 * Docs: https://docs.sepay.vn
 */

export interface SepayQRRequest {
    account_number: string // Số tài khoản
    account_name: string // Tên tài khoản
    amount: number // Số tiền (0 = user tự nhập)
    content: string // Nội dung chuyển khoản
}

export interface SepayQRResponse {
    status: number
    messages: {
        success: boolean
        message: string
        data: {
            qr: string // Base64 QR code image
        }
    }
}

export interface SepayWebhookPayload {
    id: number
    gateway: string // Tên ngân hàng (e.g., "TPBank")
    transactionDate: string // "2025-10-26 20:43:46"
    accountNumber: string // Số tài khoản nhận
    subAccount: string | null
    transferAmount: number // Số tiền chuyển (positive = in, negative = out)
    transferType: string // "in" or "out"
    accumulated: number // Số dư tài khoản
    code: string | null // Mã giao dịch từ ngân hàng
    content: string // Nội dung chuyển khoản chính
    description: string // Mô tả đầy đủ từ bank
    referenceCode: string // Mã tham chiếu (unique)
}

export interface SepayAccountInfo {
    account_number: string
    account_name: string
    bank_name: string
    bank_short_name: string
    bank_code: string // For QR URL generation (e.g., "MB", "VCB")
}
