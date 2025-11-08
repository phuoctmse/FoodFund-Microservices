import { Injectable } from "@nestjs/common"
import { Donation, Prisma, PrismaClient } from "../../generated/campaign-client"
import { CreateDonationRepositoryInput } from "../dtos/create-donation-repository.input"
import { PaymentStatus } from "../../shared/enum/campaign.enum"

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
            payment_link_id: string | null
            created_at: Date
        }>
    > {
        const items = await this.prisma.payment_Transaction.findMany({
            where: {
                status: PaymentStatus.PENDING,
                created_at: {
                    lt: before,
                },
                OR: [{ payment_link_id: { not: null } }, { order_code: { not: null } }],
            },
            select: {
                id: true,
                order_code: true,
                payment_link_id: true,
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
                description: data.description,
                checkout_url: data.checkout_url,
                qr_code: data.qr_code,
                payment_link_id: data.payment_link_id,
                status: PaymentStatus.PENDING,
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
                        status: PaymentStatus.SUCCESS,
                    },
                },
            },
            include: {
                campaign: true,
                payment_transactions: {
                    where: {
                        status: PaymentStatus.SUCCESS,
                    },
                },
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: options?.orderBy ?? { created_at: "desc" },
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
                    status: PaymentStatus.SUCCESS,
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
                        increment: 1,
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
                status: PaymentStatus.FAILED,
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
     */
    async findPaymentTransactionByReference(referenceNumber: string) {
        return this.prisma.payment_Transaction.findFirst({
            where: { reference: referenceNumber },
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
     * Update payment transaction to SUCCESS status
     */
    async updatePaymentTransactionSuccess(data: {
        order_code: bigint
        gateway: string
        processed_by_webhook: boolean
        is_matched: boolean
        reference: string
        transaction_datetime: Date
        counter_account_bank_id?: string
        counter_account_bank_name?: string
        counter_account_name?: string
        counter_account_number?: string
        virtual_account_name?: string
        virtual_account_number?: string
    }) {
        return this.prisma.$transaction(async (tx) => {
            // Update payment transaction
            const payment = await tx.payment_Transaction.update({
                where: { order_code: data.order_code },
                data: {
                    status: PaymentStatus.SUCCESS,
                    gateway: data.gateway,
                    processed_by_webhook: data.processed_by_webhook,
                    is_matched: data.is_matched,
                    reference: data.reference,
                    transaction_datetime: data.transaction_datetime,
                    counter_account_bank_id: data.counter_account_bank_id,
                    counter_account_bank_name: data.counter_account_bank_name,
                    counter_account_name: data.counter_account_name,
                    counter_account_number: data.counter_account_number,
                    virtual_account_name: data.virtual_account_name,
                    virtual_account_number: data.virtual_account_number,
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

            // Update campaign stats
            await tx.campaign.update({
                where: { id: payment.donation.campaign_id },
                data: {
                    received_amount: {
                        increment: payment.amount,
                    },
                    donation_count: {
                        increment: 1,
                    },
                },
            })

            return payment
        })
    }

    /**
     * Update payment transaction to FAILED status
     */
    async updatePaymentTransactionFailed(data: {
        order_code: bigint
        gateway: string
        processed_by_webhook: boolean
        is_matched: boolean
        error_code: string
        error_description: string
    }) {
        return this.prisma.payment_Transaction.update({
            where: { order_code: data.order_code },
            data: {
                status: PaymentStatus.FAILED,
                gateway: data.gateway,
                processed_by_webhook: data.processed_by_webhook,
                is_matched: data.is_matched,
                error_code: data.error_code,
                error_description: data.error_description,
                updated_at: new Date(),
            },
        })
    }
    async findByOrderCode(orderCode: string) {
        const orderCodeBigInt = BigInt(orderCode)

        const paymentTransaction = await this.prisma.payment_Transaction.findUnique({
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

        return paymentTransaction?.donation || null
    }
}
