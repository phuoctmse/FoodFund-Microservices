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
     * Use case: Donation received but validation failed
     * Note: With Sepay, most donations are auto-approved. This is for edge cases.
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
            paymentTx.amount_in, // Use amount_in from Sepay
            adminNote,
        )

        this.logger.log(
            `[ADMIN] Donation ${payment.id} manually approved by ${adminUsername}`,
            {
                paymentId: paymentTx.id,
                amount: paymentTx.amount_in.toString(),
                campaignId: payment.campaign_id,
            },
        )

        return {
            success: true,
            message: `Donation approved successfully. Campaign stats updated with ${paymentTx.amount_in} VND.`,
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
            referenceNumber: payment.reference_number,
            gateway: payment.gateway,
            amountIn: payment.amount_in.toString(),
            transactionContent: payment.transaction_content,
            errorDescription: payment.error_description,
            transactionDate: payment.transaction_date,
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
            campaignId: donation.campaign_id,
            amount: donation.amount.toString(),
            isAnonymous: donation.is_anonymous,
            // Payment transaction info
            paymentId: paymentTx.id,
            gateway: paymentTx.gateway,
            transactionDate: paymentTx.transaction_date,
            accountNumber: paymentTx.account_number,
            amountIn: paymentTx.amount_in.toString(),
            amountOut: paymentTx.amount_out.toString(),
            transactionContent: paymentTx.transaction_content,
            referenceNumber: paymentTx.reference_number,
            status: paymentTx.status,
            errorDescription: paymentTx.error_description,
            // Timestamps
            createdAt: donation.created_at,
        }
    }
}
