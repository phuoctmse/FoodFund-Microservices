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
                campaign: {
                    connect: { id: data.campaign_id },
                },
                amount: data.amount,
                message: data.message,
                is_anonymous: data.is_anonymous,
            },
            include: {
                campaign: true,
                payment_transactions: true,
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
                campaign: {
                    connect: { id: data.campaign_id },
                },
                amount: data.amount,
                message: data.message,
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
            where: { campaign_id: campaignId },
            include: {
                campaign: true,
                payment_transactions: true,
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
            where: { reference_number: referenceNumber },
        })
    }

    /**
     * Create donation from dynamic QR payment (auto-created by Sepay webhook)
     * This is for payments made via dynamic QR code with encoded user info
     */
    async createDonationFromDynamicQR(data: {
        campaignId: string
        donorId: string // Can be userId or "anonymous"
        sepayTransactionId: number // Sepay transaction ID
        gateway: string // Bank name
        transactionDate: string // Transaction timestamp
        accountNumber: string // Receiving account
        subAccount?: string
        amountIn: bigint // Amount received
        amountOut: bigint // Amount sent (usually 0)
        accumulated: bigint // Account balance
        code?: string // Bank transaction code
        transactionContent: string // Transfer description
        referenceNumber: string // Unique reference
        body?: string // Additional data
    }) {
        return this.prisma.$transaction(async (tx) => {
            // Create donation with donor info
            const donation = await tx.donation.create({
                data: {
                    donor_id: data.donorId,
                    campaign_id: data.campaignId,
                    amount: data.amountIn, // Use amount_in from Sepay
                    message: null,
                    is_anonymous: data.donorId === "anonymous",
                },
            })

            // Create payment transaction with Sepay data
            await tx.payment_Transaction.create({
                data: {
                    donation_id: donation.id,
                    gateway: data.gateway,
                    transaction_date: new Date(data.transactionDate),
                    account_number: data.accountNumber,
                    sub_account: data.subAccount,
                    amount_in: data.amountIn,
                    amount_out: data.amountOut,
                    accumulated: data.accumulated,
                    code: data.code,
                    transaction_content: data.transactionContent,
                    reference_number: data.referenceNumber,
                    body: data.body,
                    status: PaymentStatus.SUCCESS,
                },
            })

            // Update campaign stats
            await tx.campaign.update({
                where: { id: data.campaignId },
                data: {
                    received_amount: {
                        increment: data.amountIn,
                    },
                    donation_count: {
                        increment: 1,
                    },
                },
            })

            return donation
        })
    }
}
