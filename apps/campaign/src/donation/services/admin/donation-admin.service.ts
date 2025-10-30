import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common"
import { DonorRepository, AdminDonationRepository } from "../../repositories"
import { PaymentStatus } from "../../../shared/enum/campaign.enum"
import { ApproveManualDonationInput } from "../../dtos"
import { UserDataLoader } from "../../../shared/dataloaders/user.dataloader"

@Injectable()
export class DonationAdminService {
    private readonly logger = new Logger(DonationAdminService.name)

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly adminDonationRepository: AdminDonationRepository,
        private readonly userDataLoader: UserDataLoader,
    ) {}

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

        await this.adminDonationRepository.manualApprovePayment(
            paymentTx.id,
            payment.campaign_id,
            paymentTx.amount,
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
        const payments = await this.adminDonationRepository.findFailedPayments({
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

    /**
     * Get donation dashboard statistics
     */
    async getDashboardStatistics(): Promise<any> {
        const [stats, topCampaigns, topDonors] = await Promise.all([
            this.adminDonationRepository.getDonationStatistics(),
            this.adminDonationRepository.getTopCampaigns(5),
            this.adminDonationRepository.getTopDonors(5),
        ])

        // Calculate status counts
        const statusMap = new Map(
            stats.statusCounts.map((s) => [s.status, s._count.id]),
        )

        const successfulDonations = statusMap.get(PaymentStatus.SUCCESS) || 0
        const pendingDonations = statusMap.get(PaymentStatus.PENDING) || 0
        const failedDonations = statusMap.get(PaymentStatus.FAILED) || 0
        const refundedDonations = statusMap.get(PaymentStatus.REFUNDED) || 0

        const successRate =
            stats.totalDonations > 0
                ? ((successfulDonations / stats.totalDonations) * 100).toFixed(
                    2,
                )
                : "0.00"

        return {
            statistics: {
                totalAmount: stats.totalAmount.toString(),
                totalDonations: stats.totalDonations,
                successfulDonations,
                pendingDonations,
                failedDonations,
                refundedDonations,
                successRate,
                uniqueDonors: stats.uniqueDonors,
                campaignsWithDonations: stats.campaignsWithDonations,
            },
            topCampaigns: topCampaigns.map((c) => ({
                campaignId: c.campaignId,
                campaignTitle: c.campaignTitle,
                totalAmount: c.totalAmount.toString(),
                donationCount: c.donationCount,
            })),
            topDonors: topDonors.map((d) => ({
                donorId: d.donor_id,
                donorName: d.donor_name || "Anonymous",
                totalAmount: d._sum.amount?.toString() || "0",
                donationCount: d._count.id,
            })),
        }
    }

    /**
     * Get all donations with filters
     */
    async getAllDonations(options: {
        status?: string
        campaignId?: string
        searchDonorName?: string
        startDate?: string
        endDate?: string
        minAmount?: string
        maxAmount?: string
        sortBy?: string
        sortOrder?: string
        skip?: number
        take?: number
    }): Promise<any> {
        const { donations, totalCount } =
            await this.adminDonationRepository.findAllWithFilters({
                status: options.status,
                campaignId: options.campaignId,
                startDate: options.startDate
                    ? new Date(options.startDate)
                    : undefined,
                endDate: options.endDate
                    ? new Date(options.endDate)
                    : undefined,
                minAmount: options.minAmount
                    ? BigInt(options.minAmount)
                    : undefined,
                maxAmount: options.maxAmount
                    ? BigInt(options.maxAmount)
                    : undefined,
                skip: options.skip,
                take: options.take,
            })

        // Filter by donor name if provided
        let filteredDonations = donations
        if (options.searchDonorName) {
            const searchTerm = options.searchDonorName.toLowerCase()
            filteredDonations = donations.filter((d: any) =>
                d.donor_name?.toLowerCase().includes(searchTerm),
            )
        }

        // Fetch donor names for donations without donor_name
        const donorIdsToFetch = filteredDonations
            .filter(
                (d: any) =>
                    !d.donor_name &&
                    !d.is_anonymous &&
                    d.donor_id !== "anonymous",
            )
            .map((d: any) => d.donor_id)

        const uniqueDonorIds = [...new Set(donorIdsToFetch)]
        const users =
            uniqueDonorIds.length > 0
                ? await this.userDataLoader.loadMany(uniqueDonorIds)
                : []

        const userNameMap = new Map<string, string>()
        users.forEach((user, index) => {
            if (user) {
                const userName =
                    user.fullName || user.username || "Unknown Donor"
                userNameMap.set(uniqueDonorIds[index], userName)
            }
        })

        // Map donations with donor names and status
        const mappedDonations = filteredDonations.map((donation: any) => {
            let donorName = donation.donor_name
            if (!donorName) {
                if (
                    donation.is_anonymous ||
                    donation.donor_id === "anonymous"
                ) {
                    donorName = "Người dùng ẩn danh"
                } else {
                    donorName =
                        userNameMap.get(donation.donor_id) || "Unknown Donor"
                }
            }

            // Determine status from payment transactions
            let status = "PENDING"
            let transactionDatetime = null
            let orderCode = null

            if (donation.payment_transactions?.length > 0) {
                const successTx = donation.payment_transactions.find(
                    (tx: any) => tx.status === "SUCCESS",
                )
                const failedTx = donation.payment_transactions.find(
                    (tx: any) => tx.status === "FAILED",
                )
                const refundedTx = donation.payment_transactions.find(
                    (tx: any) => tx.status === "REFUNDED",
                )

                const relevantTx =
                    successTx ||
                    refundedTx ||
                    failedTx ||
                    donation.payment_transactions[0]

                if (successTx) {
                    status = "SUCCESS"
                    transactionDatetime = successTx.transaction_datetime
                } else if (refundedTx) {
                    status = "REFUNDED"
                } else if (failedTx) {
                    status = "FAILED"
                }

                if (relevantTx?.order_code) {
                    orderCode = relevantTx.order_code.toString()
                }
            }

            return {
                id: donation.id,
                donorId: donation.donor_id,
                donorName,
                campaignId: donation.campaign_id,
                amount: donation.amount.toString(),
                isAnonymous: donation.is_anonymous ?? false,
                status,
                orderCode,
                transactionDatetime,
                created_at: donation.created_at,
                updated_at: donation.updated_at,
            }
        })

        // Apply sorting
        const sortBy = options.sortBy || "createdAt"
        const sortOrder = options.sortOrder || "desc"

        mappedDonations.sort((a: any, b: any) => {
            let compareValue = 0

            switch (sortBy) {
            case "amount":
                compareValue = Number(a.amount) - Number(b.amount)
                break
            case "transactionDate":
                compareValue =
                        new Date(
                            a.transactionDatetime || a.created_at,
                        ).getTime() -
                        new Date(
                            b.transactionDatetime || b.created_at,
                        ).getTime()
                break
            case "createdAt":
            default:
                compareValue =
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                break
            }

            return sortOrder === "asc" ? compareValue : -compareValue
        })

        // Calculate total amount of filtered donations
        const totalAmount = mappedDonations
            .filter((d: any) => d.status === "SUCCESS")
            .reduce((sum: bigint, d: any) => sum + BigInt(d.amount), BigInt(0))

        return {
            donations: mappedDonations,
            totalCount,
            totalAmount: totalAmount.toString(),
        }
    }
}
