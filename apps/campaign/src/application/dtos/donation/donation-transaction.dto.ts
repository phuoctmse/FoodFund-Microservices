export interface DonationTransactionData {
    donationId: string
    donorId: string
    campaignId: string
    donationAmount: bigint
    message: string | undefined
    isAnonymous: boolean
    orderCode: number
    payosResult: {
        qrCode: string | null
        checkoutUrl: string | null
        paymentLinkId: string | null
    }
}

export interface DonationNotificationData {
    donationId: string
    donorId: string
    campaignId: string
    donationAmount: bigint
    message: string | undefined
    isAnonymous: boolean
    orderCode: number
    transferContent: string
    paymentLinkId: string | null
    checkoutUrl: string | null
}
