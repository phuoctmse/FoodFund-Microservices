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

    async findById(id: string): Promise<Donation | null> {
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

    // Payment Transaction methods
    async createPaymentTransaction(data: {
        donationId: string
        orderCode: bigint
        amount: bigint
        paymentLinkId: string
        checkoutUrl: string
        qrCode: string
    }) {
        return this.prisma.payment_Transaction.create({
            data: {
                donation_id: data.donationId,
                order_code: data.orderCode,
                amount: data.amount,
                payment_link_id: data.paymentLinkId,
                checkout_url: data.checkoutUrl,
                qr_code: data.qrCode,
                status: PaymentStatus.PENDING,
            },
        })
    }

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

    async updatePaymentTransactionStatus(
        id: string,
        status: PaymentStatus,
        additionalData?: {
            accountName?: string
            accountNumber?: string
            description?: string
            accountBankName?: string
            transactionDateTime?: string
        },
    ) {
        return this.prisma.payment_Transaction.update({
            where: { id },
            data: {
                status,
                account_name: additionalData?.accountName,
                account_number: additionalData?.accountNumber,
                account_bank_name: additionalData?.accountBankName,
                description: additionalData?.description,
                transaction_datetime: additionalData?.transactionDateTime
                    ? new Date(additionalData.transactionDateTime)
                    : undefined,
                updated_at: new Date(),
            },
        })
    }

    async updateCampaignStats(campaignId: string, amount: bigint) {
        return this.prisma.campaign.update({
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
    }

    async updatePaymentWithTransaction(
        paymentId: string,
        status: PaymentStatus,
        additionalData?: {
            accountName?: string
            accountNumber?: string
            description?: string
            accountBankName?: string
            transactionDateTime?: string
        },
        campaignUpdate?: {
            campaignId: string
            amount: bigint
        },
    ) {
        return this.prisma.$transaction(async (tx) => {
            // Step 1: Update payment transaction status
            // Only update if current status is PENDING to avoid downgrades or double-processing
            const updatedPayment = await tx.payment_Transaction.updateMany({
                where: { id: paymentId, status: PaymentStatus.PENDING },
                data: {
                    status,
                    account_name: additionalData?.accountName,
                    account_number: additionalData?.accountNumber,
                    account_bank_name: additionalData?.accountBankName,
                    description: additionalData?.description,
                    transaction_datetime: additionalData?.transactionDateTime
                        ? new Date(additionalData.transactionDateTime)
                        : undefined,
                    updated_at: new Date(),
                },
            })

            // If no rows updated, status was not PENDING; return current record without side effects
            if (updatedPayment.count === 0) {
                return tx.payment_Transaction.findUnique({
                    where: { id: paymentId },
                })
            }

            // Only increment stats when we just transitioned to SUCCESS
            if (campaignUpdate && status === PaymentStatus.SUCCESS) {
                await tx.campaign.update({
                    where: { id: campaignUpdate.campaignId },
                    data: {
                        received_amount: {
                            increment: campaignUpdate.amount,
                        },
                        donation_count: {
                            increment: 1,
                        },
                    },
                })
            }

            return tx.payment_Transaction.findUnique({ where: { id: paymentId } })
        })
    }
}
