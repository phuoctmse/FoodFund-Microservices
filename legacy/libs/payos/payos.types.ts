export interface PayOSConfig {
    clientId: string
    apiKey: string
    checksumKey: string
    environment?: "sandbox" | "production"
}

export interface PayOSPaymentData {
    orderCode: number
    amount: number
    description: string
    items?: PayOSItem[]
    cancelUrl?: string
    returnUrl?: string
    signature?: string
    buyerName?: string
    buyerEmail?: string
    buyerPhone?: string
    buyerAddress?: string
    expiredAt?: number
}

export interface PayOSItem {
    name: string
    quantity: number
    price: number
}

export interface PayOSPaymentResponse {
    bin: string
    accountNumber: string
    accountName: string
    amount: number
    description: string
    orderCode: number
    currency: string
    paymentLinkId: string
    status: string
    checkoutUrl: string
    qrCode: string
}

export interface PayOSWebhookData {
    orderCode: number
    amount: number
    description: string
    accountNumber: string
    reference: string
    transactionDateTime: string
    currency: string
    paymentLinkId: string
    code: string
    desc: string
    counterAccountBankId?: string
    counterAccountBankName?: string
    counterAccountName?: string
    counterAccountNumber?: string
    virtualAccountName?: string
    virtualAccountNumber?: string
}

export interface PayOSPaymentLinkData {
    orderCode: number
    amount: number
    description: string
    items?: PayOSItem[]
    returnUrl?: string
    cancelUrl?: string
    signature?: string
    buyerName?: string
    buyerEmail?: string
    buyerPhone?: string
    buyerAddress?: string
    expiredAt?: number
}

export interface PayOSTransactionStatus {
    id: string
    orderCode: number
    amount: number
    amountPaid: number
    amountRemaining: number
    status: "PENDING" | "PROCESSING" | "PAID" | "CANCELLED"
    createdAt: string
    transactions: PayOSTransaction[]
}

export interface PayOSTransaction {
    reference: string
    amount: number
    accountNumber: string
    description: string
    transactionDateTime: string
    virtualAccountName?: string
    virtualAccountNumber?: string
    counterAccountBankId?: string
    counterAccountBankName?: string
    counterAccountName?: string
    counterAccountNumber?: string
}

export interface PayOSError {
    code: string
    desc: string
    data?: any
}
