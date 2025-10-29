import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common"
import { DonorRepository } from "../../repositories/donor.repository"
import { PaymentStatus } from "../../../shared/enum/campaign.enum"
import { ApproveManualDonationInput } from "../../dtos"

@Injectable()
export class DonationAdminService {
    private readonly logger = new Logger(DonationAdminService.name)

    constructor(private readonly donorRepository: DonorRepository) {}

    /**
     * Admin manually approve a FAILED donation
     * Use case: Payment failed but admin wants to manually approve it
     * Note: With PayOS webhook, most donations are auto-approved. This is for edge cases.
     */
    async approveManualDonation(
        input: ApproveManualDonationInput,
        adminUsername: string,
    ): Promise<{
        success: boolean
        message: string
        donationId: string
    }> {
        this.logger.log(
            `[ADMIN] Manual approval requested for payment ${input.orderCode} by ${adminUsername}`,
        )

        // Find payment transaction by ID (orderCode is now donation ID)
        const payment = await this.donorRepository.findById(
            input.orderCode.toString(),
        )

        if (!payment) {
            throw new NotFoundException(`Payment not found: ${input.orderCode}`)
        }

        // Get payment transaction
        const paymentTx = payment.payment_transactions[0]
        if (!paymentTx) {
            throw new NotFoundException("Payment transaction not found")
        }

        // Check current status
        if (paymentTx.status === PaymentStatus.SUCCESS) {
            return {
                success: false,
                message: "Donation already marked as SUCCESS",
                donationId: payment.id,
            }
        }

        if (paymentTx.status === PaymentStatus.REFUNDED) {
            throw new BadRequestException("Cannot approve a refunded donation")
        }

        // Validate if force approve is needed
        if (!input.forceApprove && paymentTx.error_description) {
            throw new BadRequestException(
                `Donation has validation errors: ${paymentTx.error_description}. Use forceApprove=true to override.`,
            )
        }

        // Approve donation
        const adminNote = input.adminNote
            ? `Manual approval by ${adminUsername}: ${input.adminNote}`
            : `Manual approval by ${adminUsername}`

        await this.donorRepository.manualApprovePayment(
            paymentTx.id,
            payment.campaign_id,
            paymentTx.amount, // Use amount from PayOS
            adminNote,
        )

        this.logger.log(
            `[ADMIN] Donation ${payment.id} manually approved by ${adminUsername}`,
            {
                paymentId: paymentTx.id,
                amount: paymentTx.amount.toString(),
                campaignId: payment.campaign_id,
            },
        )

        return {
            success: true,
            message: `Donation approved successfully. Campaign stats updated with ${paymentTx.amount} VND.`,
            donationId: payment.id,
        }
    }

    /**
     * Get list of FAILED donations that need manual review
     */
    async getFailedDonations(options?: {
        skip?: number
        take?: number
    }): Promise<any[]> {
        const payments = await this.donorRepository.findFailedPayments({
            skip: options?.skip ?? 0,
            take: options?.take ?? 50,
        })

        return payments.map((payment) => ({
            id: payment.id,
            orderCode: payment.order_code?.toString(),
            paymentLinkId: payment.payment_link_id,
            amount: payment.amount.toString(),
            description: payment.description,
            errorDescription: payment.error_description,
            transactionDate: payment.transaction_datetime,
            campaignId: payment.donation.campaign_id,
            campaignTitle: payment.donation.campaign.title,
            createdAt: payment.created_at,
        }))
    }

    /**
     * Get donation details for admin review
     */
    async getDonationDetails(donationId: string): Promise<any> {
        const donation = await this.donorRepository.findById(donationId)

        if (!donation) {
            throw new NotFoundException(`Donation not found: ${donationId}`)
        }

        const paymentTx = donation.payment_transactions[0]
        if (!paymentTx) {
            throw new NotFoundException("Payment transaction not found")
        }

        return {
            id: donation.id,
            donorId: donation.donor_id,
            donorName: donation.donor_name,
            campaignId: donation.campaign_id,
            amount: donation.amount.toString(),
            isAnonymous: donation.is_anonymous,
            // Payment transaction info (PayOS)
            paymentId: paymentTx.id,
            orderCode: paymentTx.order_code?.toString(),
            paymentAmount: paymentTx.amount.toString(),
            description: paymentTx.description,
            checkoutUrl: paymentTx.checkout_url,
            qrCode: paymentTx.qr_code,
            paymentLinkId: paymentTx.payment_link_id,
            reference: paymentTx.reference,
            transactionDatetime: paymentTx.transaction_datetime,
            counterAccountNumber: paymentTx.counter_account_number,
            counterAccountName: paymentTx.counter_account_name,
            counterAccountBankName: paymentTx.counter_account_bank_name,
            status: paymentTx.status,
            errorCode: paymentTx.error_code,
            errorDescription: paymentTx.error_description,
            // Timestamps
            createdAt: donation.created_at,
        }
    }
}
