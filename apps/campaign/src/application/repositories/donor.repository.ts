import { Injectable } from "@nestjs/common"
import { Donation, Prisma, PrismaClient } from "../../generated/campaign-client"
import {
    TransactionStatus,
    PaymentAmountStatus,
} from "../../shared/enum/campaign.enum"
import { CreateDonationRepositoryInput } from "../dtos/donation"

@Injectable()
export class DonorRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateDonationRepositoryInput): Promise<Donation> {
        return this.prisma.donation.create({
            data: {
                donor_id: data.donor_id,
                donor_name: data.donor_name,
                campaign: {
                    connect: { id: data.campaign_id },
                },
                amount: data.amount,
                is_anonymous: data.is_anonymous,
            },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    /**
     * Find PENDING PayOS payment links created before a given threshold
     * Only transactions with a stored payment_link_id OR order_code will be returned
     */
    async findPendingPayosLinksBefore(
        before: Date,
        take = 500,
    ): Promise<
        Array<{
            id: string
            order_code: bigint | null
            payos_metadata: any
            created_at: Date
        }>
    > {
        const items = await this.prisma.payment_Transaction.findMany({
            where: {
                status: TransactionStatus.PENDING,
                created_at: {
                    lt: before,
                },
                payos_metadata: { not: Prisma.JsonNull },
            },
            select: {
                id: true,
                order_code: true,
                payos_metadata: true,
                created_at: true,
            },
            orderBy: { created_at: "asc" },
            take,
        })

        return items
    }

    async createPaymentTransaction(data: {
        donation_id: string
        order_code: bigint
        amount: bigint
        description: string
        checkout_url: string
        qr_code: string
        payment_link_id: string
    }) {
        return this.prisma.payment_Transaction.create({
            data: {
                donation_id: data.donation_id,
                order_code: data.order_code,
                amount: data.amount,
                received_amount: BigInt(0), // Initialize to 0
                description: data.description,
                payos_metadata: {
                    checkout_url: data.checkout_url,
                    qr_code: data.qr_code,
                    payment_link_id: data.payment_link_id,
                },
                status: TransactionStatus.PENDING,
                payment_status: PaymentAmountStatus.PENDING,
            },
        })
    }

    async createWithId(
        id: string,
        data: CreateDonationRepositoryInput,
    ): Promise<Donation> {
        return this.prisma.donation.create({
            data: {
                id,
                donor_id: data.donor_id,
                donor_name: data.donor_name,
                campaign: {
                    connect: { id: data.campaign_id },
                },
                amount: data.amount,
                is_anonymous: data.is_anonymous,
            },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    async findById(id: string) {
        return this.prisma.donation.findUnique({
            where: { id },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    async findByDonorId(
        donorId: string,
        options?: {
            skip?: number
            take?: number
            orderBy?: Prisma.DonationOrderByWithRelationInput
        },
    ): Promise<Donation[]> {
        return this.prisma.donation.findMany({
            where: { donor_id: donorId },
            include: {
                campaign: true,
                payment_transactions: true,
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: options?.orderBy ?? { created_at: "desc" },
        })
    }

    async findByCampaignId(
        campaignId: string,
        options?: {
            skip?: number
            take?: number
            orderBy?: Prisma.DonationOrderByWithRelationInput
        },
    ): Promise<Donation[]> {
        return this.prisma.donation.findMany({
            where: {
                campaign_id: campaignId,
                // Only get donations with successful payment transactions
                payment_transactions: {
                    some: {
                        status: TransactionStatus.SUCCESS,
                    },
                },
            },
            include: {
                campaign: true,
                payment_transactions: {
                    where: {
                        status: TransactionStatus.SUCCESS,
                    },
                },
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: options?.orderBy ?? { created_at: "desc" },
        })
    }
    async findPaymentTransactionsByCampaignId(
        campaignId: string,
        options?: {
            skip?: number
            take?: number
            searchDonorName?: string
        },
    ) {
        const whereClause: any = {
            donation: {
                campaign_id: campaignId,
            },
            status: TransactionStatus.SUCCESS,
        }

        // If search by donor name, add filter
        if (options?.searchDonorName) {
            whereClause.donation = {
                ...whereClause.donation,
                donor_name: {
                    contains: options.searchDonorName,
                    mode: "insensitive",
                },
            }
        }

        return this.prisma.payment_Transaction.findMany({
            where: whereClause,
            include: {
                donation: {
                    select: {
                        donor_name: true,
                        is_anonymous: true,
                        donor_id: true,
                    },
                },
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: { created_at: "desc" },
        })
    }

    async getTotalDonationsByCampaign(campaignId: string): Promise<{
        totalAmount: bigint
        donationCount: number
    }> {
        const result = await this.prisma.donation.aggregate({
            where: { campaign_id: campaignId },
            _sum: { amount: true },
            _count: { id: true },
        })

        return {
            totalAmount: result._sum.amount || BigInt(0),
            donationCount: result._count.id || 0,
        }
    }

    async getDonationStats(donorId: string): Promise<{
        totalDonated: bigint
        donationCount: number
        campaignCount: number
    }> {
        const [donations, campaignCount] = await Promise.all([
            this.prisma.donation.aggregate({
                where: { donor_id: donorId },
                _sum: { amount: true },
                _count: { id: true },
            }),
            this.prisma.donation.groupBy({
                by: ["campaign_id"],
                where: { donor_id: donorId },
                _count: { campaign_id: true },
            }),
        ])

        return {
            totalDonated: donations._sum.amount || BigInt(0),
            donationCount: donations._count.id || 0,
            campaignCount: campaignCount.length,
        }
    }

    /**
     * Admin manually approve a FAILED payment
     * Updates status to SUCCESS and increments campaign stats
     */
    async manualApprovePayment(
        paymentId: string,
        campaignId: string,
        amount: bigint,
        adminNote: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            // Update payment status
            const payment = await tx.payment_Transaction.update({
                where: { id: paymentId },
                data: {
                    status: TransactionStatus.SUCCESS,
                    error_description: adminNote, // Store admin note
                    updated_at: new Date(),
                },
            })

            // Increment campaign stats
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    received_amount: {
                        increment: amount,
                    },
                    donation_count: {
                        increment: 1, // Count manual approved payments
                    },
                },
            })

            return payment
        })
    }

    /**
     * Find FAILED payments for admin review
     */
    async findFailedPayments(options?: { skip?: number; take?: number }) {
        return this.prisma.payment_Transaction.findMany({
            where: {
                status: TransactionStatus.FAILED,
            },
            include: {
                donation: {
                    include: {
                        campaign: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            skip: options?.skip,
            take: options?.take,
        })
    }

    /**
     * Find campaign by ID
     */
    async findCampaignById(campaignId: string) {
        return this.prisma.campaign.findUnique({
            where: { id: campaignId },
        })
    }

    /**
     * Find payment transaction by reference number (for idempotency)
     * Reference is now stored in payos_metadata JSON
     */
    async findPaymentTransactionByReference(referenceNumber: string) {
        return this.prisma.payment_Transaction.findFirst({
            where: {
                payos_metadata: {
                    path: ["reference"],
                    equals: referenceNumber,
                },
            },
        })
    }

    /**
     * Find payment transaction by order code
     */
    async findPaymentTransactionByOrderCode(orderCode: bigint) {
        return this.prisma.payment_Transaction.findUnique({
            where: { order_code: orderCode },
            include: {
                donation: {
                    include: {
                        campaign: true,
                    },
                },
            },
        })
    }

    /**
     * Update payment transaction to SUCCESS status (used by PayOS/Sepay webhooks)
     */
    async updatePaymentTransactionSuccess(data: {
        order_code: bigint
        amount_paid: bigint
        gateway: string
        processed_by_webhook: boolean
        payos_metadata?: {
            payment_link_id?: string
            reference?: string
            transaction_datetime?: Date
            counter_account_bank_id?: string
            counter_account_bank_name?: string
            counter_account_name?: string
            counter_account_number?: string
            virtual_account_name?: string
            virtual_account_number?: string
        }
        sepay_metadata?: {
            sepay_id: number
            reference_code: string
            content: string
            bank_name: string
            transaction_date: string
            accumulated: number
            sub_account: string | null
            description: string
        }
    }) {
        return this.prisma.$transaction(async (tx) => {
            // Get original payment
            const originalPayment = await tx.payment_Transaction.findUnique({
                where: { order_code: data.order_code },
                include: {
                    donation: {
                        include: {
                            campaign: true,
                        },
                    },
                },
            })

            if (!originalPayment) {
                throw new Error(
                    `Payment with order_code ${data.order_code} not found`,
                )
            }

            // Calculate payment_status
            let payment_status: "PENDING" | "PARTIAL" | "COMPLETED" | "OVERPAID"
            if (data.amount_paid < originalPayment.amount) {
                payment_status = "PARTIAL"
            } else if (data.amount_paid === originalPayment.amount) {
                payment_status = "COMPLETED"
            } else {
                payment_status = "OVERPAID"
            }

            // Update payment transaction
            const payment = await tx.payment_Transaction.update({
                where: { order_code: data.order_code },
                data: {
                    status: TransactionStatus.SUCCESS,
                    received_amount: data.amount_paid,
                    payment_status,
                    gateway: data.gateway,
                    processed_by_webhook: data.processed_by_webhook,
                    payos_metadata: data.payos_metadata,
                    sepay_metadata: data.sepay_metadata,
                    updated_at: new Date(),
                },
                include: {
                    donation: {
                        include: {
                            campaign: true,
                        },
                    },
                },
            })

            // Update campaign stats with ACTUAL amount received
            const updatedCampaign = await tx.campaign.update({
                where: { id: payment.donation.campaign_id },
                data: {
                    received_amount: {
                        increment: data.amount_paid,
                    },
                    donation_count: {
                        increment: 1,
                    },
                },
                select: {
                    id: true,
                    title: true,
                    received_amount: true,
                    target_amount: true,
                    status: true,
                    created_by: true,
                },
            })

            return { payment, campaign: updatedCampaign }
        })
    }

    /**
     * Update payment transaction to FAILED status
     */
    async updatePaymentTransactionFailed(data: {
        order_code: bigint
        gateway: string
        processed_by_webhook: boolean
        error_code: string
        error_description: string
    }) {
        return this.prisma.payment_Transaction.update({
            where: { order_code: data.order_code },
            data: {
                status: TransactionStatus.FAILED,
                gateway: data.gateway,
                processed_by_webhook: data.processed_by_webhook,
                error_code: data.error_code,
                error_description: data.error_description,
                updated_at: new Date(),
            },
        })
    }

    /**
     * Track Sepay partial payment (mark to prevent PayOS duplicate)
     * This is called when Sepay processes a transfer with orderCode
     */
    async trackSepayPartialPayment(data: {
        order_code: bigint
        sepay_transaction_id: number
        sepay_reference_number: string
    }) {
        return this.prisma.payment_Transaction.update({
            where: { order_code: data.order_code },
            data: {
                sepay_metadata: {
                    sepay_transaction_id: data.sepay_transaction_id,
                    sepay_reference_number: data.sepay_reference_number,
                },
                gateway: "SEPAY", // Mark as processed by Sepay
                updated_at: new Date(),
            },
        })
    }

    async findByOrderCode(orderCode: string) {
        const orderCodeBigInt = BigInt(orderCode)

        const paymentTransaction =
            await this.prisma.payment_Transaction.findUnique({
                where: { order_code: orderCodeBigInt },
                include: {
                    donation: {
                        include: {
                            payment_transactions: {
                                orderBy: {
                                    created_at: "desc",
                                },
                            },
                        },
                    },
                },
            })

        return paymentTransaction?.donation ?? null
    }

    /**
     * Create supplementary payment transaction (for additional transfers with same description)
     * Used when user transfers money multiple times for the same donation
     */
    async createSupplementaryPayment(data: {
        donation_id: string
        amount: bigint // Amount of this supplementary payment
        gateway: string
        description?: string
        payos_metadata?: any
        sepay_metadata?: any
    }) {
        return this.prisma.$transaction(async (tx) => {
            // Create new payment transaction (WITHOUT order_code)
            const payment = await tx.payment_Transaction.create({
                data: {
                    donation_id: data.donation_id,
                    order_code: null, // Supplementary payment has NO orderCode
                    amount: data.amount,
                    received_amount: data.amount, // Same as amount for supplementary
                    description: data.description,
                    status: TransactionStatus.SUCCESS,
                    payment_status: "COMPLETED",
                    gateway: data.gateway,
                    processed_by_webhook: true,
                    payos_metadata: data.payos_metadata,
                    sepay_metadata: data.sepay_metadata,
                },
                include: {
                    donation: {
                        include: {
                            campaign: true,
                        },
                    },
                },
            })

            // Update campaign with supplementary amount
            const updatedCampaign = await tx.campaign.update({
                where: { id: payment.donation.campaign_id },
                data: {
                    received_amount: {
                        increment: data.amount,
                    },
                    donation_count: {
                        increment: 1, // Count each Payment_Transaction (including supplementary)
                    },
                },
                select: {
                    id: true,
                    title: true,
                    received_amount: true,
                    target_amount: true,
                    status: true,
                    created_by: true,
                },
            })

            return { payment, campaign: updatedCampaign }
        })
    }

    /**
     * Check if a Sepay transfer already processed (by sepayId)
     * Used to prevent duplicate supplementary payments
     */
    async findPaymentBySepayId(sepayId: number) {
        return this.prisma.payment_Transaction.findFirst({
            where: {
                sepay_metadata: {
                    path: ["sepayId"],
                    equals: sepayId,
                },
            },
            include: {
                donation: {
                    include: {
                        campaign: true,
                    },
                },
            },
        })
    }

    /**
     * Check if a PayOS transaction already processed (by reference)
     * Used to prevent duplicate supplementary payments
     */
    async findPaymentByPayOSReference(reference: string) {
        return this.prisma.payment_Transaction.findFirst({
            where: {
                payos_metadata: {
                    path: ["reference"],
                    equals: reference,
                },
            },
            include: {
                donation: {
                    include: {
                        campaign: true,
                    },
                },
            },
        })
    }

    async getDonorsByFundraiser(fundraiserId: string): Promise<
        Array<{
            donor_id: string
            donor_name: string | null
        }>
    > {
        const donors = await this.prisma.donation.groupBy({
            by: ["donor_id", "donor_name"],
            where: {
                donor_id: { not: null as any },
                campaign: {
                    created_by: fundraiserId,
                },
                payment_transactions: {
                    some: {
                        status: TransactionStatus.SUCCESS,
                    },
                },
            },
        })

        return donors
            .filter((d) => d.donor_id !== null)
            .map((d) => ({
                donor_id: d.donor_id!,
                donor_name: d.donor_name,
            }))
    }

    async getCampaignFollowers(campaignId: string): Promise<string[]> {
        const donors = await this.prisma.donation.findMany({
            where: {
                campaign_id: campaignId,
                donor_id: {
                    not: undefined,
                },
            },
            select: {
                donor_id: true,
            },
            distinct: ["donor_id"],
        })

        return donors
            .map((d) => d.donor_id)
            .filter((id): id is string => id !== null)
    }
}
