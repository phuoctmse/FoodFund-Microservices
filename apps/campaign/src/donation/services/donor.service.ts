import {
    Injectable,
    BadRequestException,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { DonorRepository } from "../repositories/donor.repository"
import { CreateDonationInput } from "../dtos/create-donation.input"
import { DonationResponse } from "../dtos/donation-response.dto"
import { CampaignDonationInfo } from "../dtos/campaign-donation-info.dto"
import { MyDonationsResponse, DonationWithStatus } from "../dtos/my-donations-response.dto"
import {
    MyDonationDetailsResponse,
    PaymentTransactionDetail,
} from "../dtos/my-donation-details-response.dto"
import {
    DonationPaymentLinkResponse,
    DonationTransactionInfo,
} from "../dtos/donation-payment-link-response.dto"
import { CampaignDonationSummary } from "../dtos/campaign-donation-summary.dto"
import {
    CampaignDonationStatementResponse,
    DonationTransactionStatement,
} from "../dtos/campaign-donation-statement.dto"
import { CampaignStatus } from "../../campaign/enum/campaign.enum"
import { Donation } from "../models/donation.model"
import { SqsService } from "@libs/aws-sqs"
import { CurrentUserType } from "@libs/auth"
import { UserClientService } from "../../shared/services/user-client.service"
import { UserDataLoader } from "../../shared/dataloaders/user.dataloader"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { CampaignRepository } from "../../campaign"

@Injectable()
export class DonorService {
    private readonly logger = new Logger(DonorService.name)
    private payOS: PayOS | null = null

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly sqsService: SqsService,
        private readonly userClientService: UserClientService,
        private readonly userDataLoader: UserDataLoader,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private getPayOS(): PayOS {
        if (!this.payOS) {
            const config = envConfig().payos
            if (
                !config.payosClienId ||
                !config.payosApiKey ||
                !config.payosCheckSumKey
            ) {
                throw new BadRequestException(
                    "PayOS is not configured. Please contact administrator.",
                )
            }
            this.payOS = new PayOS({
                clientId: config.payosClienId,
                apiKey: config.payosApiKey,
                checksumKey: config.payosCheckSumKey,
            })
        }
        return this.payOS
    }

    /**
     * Extract description from VietQR EMV QR code
     * QR format: field 62 contains additional data with description
     */
    private extractDescriptionFromQR(qrCode: string): string | null {
        try {
            // VietQR EMV format: field 62 (Additional Data Field Template)
            // Example QR: ...62360832CS7T2L64YT0 Donate 1761660076555630463A4
            // Field 62: length=36, subfield 08: length=32, content="CS7T2L64YT0 Donate 1761660076555"

            const field62Index = qrCode.indexOf("62")
            if (field62Index === -1) return null

            const field62Length = Number.parseInt(
                qrCode.substring(field62Index + 2, field62Index + 4),
                10,
            )
            const field62Content = qrCode.substring(
                field62Index + 4,
                field62Index + 4 + field62Length,
            )

            // Find subfield 08 (Bill Number / Description)
            const subfield08Index = field62Content.indexOf("08")
            if (subfield08Index === -1) return null

            const descriptionLength = Number.parseInt(
                field62Content.substring(
                    subfield08Index + 2,
                    subfield08Index + 4,
                ),
                10,
            )
            const fullDescription = field62Content.substring(
                subfield08Index + 4,
                subfield08Index + 4 + descriptionLength,
            )

            // Return the full description (no "Donate" text since we removed it from source)
            // Example: "CS7T2L64YT0 1761660076555"
            return fullDescription.trim()
        } catch (error) {
            this.logger.warn(
                "Failed to extract description from QR code",
                error,
            )
            return null
        }
    }

    /**
     * Create a donation and generate PayOS payment link
     */
    async createDonation(
        input: CreateDonationInput,
        user: CurrentUserType | null,
    ): Promise<DonationResponse> {
        // Validate campaign
        const campaign = await this.validateCampaignForDonation(
            input.campaignId,
        )

        // Validate amount
        const donationAmount = this.validateDonationAmount(input.amount)

        // Determine donor info
        const donorId = user?.sub || "Người dùng ẩn danh"
        const isAnonymous = input.isAnonymous || !user

        // Fetch donor name if authenticated and not anonymous
        let donorName: string | undefined
        if (user && !isAnonymous) {
            this.logger.log(
                `[DONOR] Fetching donor name for cognito_id: ${user.sub}`,
            )
            const fetchedName =
                await this.userClientService.getUserNameByCognitoId(
                    user.sub as string,
                )
            this.logger.log(
                `[DONOR] Fetched donor name: ${fetchedName || "null"}`,
            )
            donorName = fetchedName || undefined
        } else if (isAnonymous) {
            donorName = "Người dùng ẩn danh"
        }

        this.logger.log(
            `[DONOR] Creating donation with donor_name: ${donorName || "null"}`,
        )

        // Create donation record
        const donation = await this.donorRepository.create({
            donor_id: donorId,
            donor_name: donorName,
            campaign_id: input.campaignId,
            amount: donationAmount,
            is_anonymous: isAnonymous,
        })

        // Generate unique order code (timestamp-based with random suffix)
        // Format: {timestamp}{randomSuffix} to prevent collision in concurrent requests
        // Example: 1762613543567123 (13 digits timestamp + 3 digits random)
        const timestamp = Date.now()
        const randomSuffix = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0") // 000-999
        const orderCode = Number(`${timestamp}${randomSuffix}`)

        // Create PayOS payment link
        // Note: returnUrl and cancelUrl are required by PayOS but not used in our flow
        // Payment status is handled via webhook
        const paymentData = {
            orderCode,
            amount: Number(donationAmount),
            description: `${orderCode}`, // Just order code, max 25 chars
            returnUrl: "",
            cancelUrl: "",
        }

        try {
            const payOS = this.getPayOS()
            const paymentLinkResponse =
                await payOS.paymentRequests.create(paymentData)

            // Create payment transaction record
            await this.donorRepository.createPaymentTransaction({
                donation_id: donation.id,
                order_code: BigInt(orderCode),
                amount: donationAmount,
                description: paymentData.description,
                checkout_url: paymentLinkResponse.checkoutUrl,
                qr_code: paymentLinkResponse.qrCode,
                payment_link_id: paymentLinkResponse.paymentLinkId,
            })

            this.logger.log(
                `[PayOS] Payment link created for donation ${donation.id}`,
                {
                    orderCode,
                    amount: donationAmount.toString(),
                    donorId,
                },
            )

            // Send to SQS for async processing (optional - for background tasks)
            try {
                await this.sqsService.sendMessage({
                    messageBody: {
                        donationId: donation.id,
                        orderCode,
                        campaignId: input.campaignId,
                        amount: donationAmount.toString(),
                    },
                })
            } catch (sqsError) {
                this.logger.warn("Failed to send SQS message", sqsError)
                // Don't fail the request if SQS fails
            }

            // Get PayOS bank account info from config
            const config = envConfig().payos

            // Extract description from QR code (VietQR EMV format)
            // QR code contains the actual transfer description that will be used
            const qrDescription = this.extractDescriptionFromQR(
                paymentLinkResponse.qrCode,
            )

            return {
                donationId: donation.id,
                qrCode: paymentLinkResponse.qrCode,
                bankName: config.payosBankName,
                bankNumber: config.payosBankNumber,
                bankAccountName: config.payosBankAccountName,
                bankFullName: config.payosBankFullName,
                bankLogo: config.payosBankLogo,
                description: qrDescription || paymentData.description,
                amount: Number(donationAmount),
            }
        } catch (error) {
            this.logger.error("[PayOS] Failed to create payment link", error)
            throw new BadRequestException("Failed to create payment link")
        }
    }

    private async validateCampaignForDonation(campaignId: string) {
        const campaign = await this.campaignRepository.findById(campaignId)

        if (!campaign) {
            throw new NotFoundException("Campaign not found")
        }

        if (!campaign.isActive) {
            throw new BadRequestException("Campaign is not active")
        }

        if (campaign.status !== CampaignStatus.ACTIVE) {
            throw new BadRequestException(
                `Cannot donate to campaign with status: ${campaign.status}. Campaign must be ACTIVE.`,
            )
        }

        const now = new Date()
        if (now < campaign.fundraisingStartDate) {
            throw new BadRequestException("Fundraising has not started yet")
        }

        if (now > campaign.fundraisingEndDate) {
            throw new BadRequestException("Fundraising period has ended")
        }

        // // Check if campaign has already reached its target amount
        // if (campaign.receivedAmount >= campaign.targetAmount) {
        //     console.debug("Campaign target reached:", {
        //         receivedAmount: campaign.receivedAmount,
        //         targetAmount: campaign.targetAmount,
        //     })
        //     throw new BadRequestException(
        //         "Campaign has already reached its fundraising goal. No more donations are accepted.",
        //     )
        // }

        return campaign
    }

    private validateDonationAmount(amount: number): bigint {
        const donationAmount = BigInt(amount)
        if (donationAmount <= 0) {
            throw new BadRequestException(
                "Donation amount must be greater than 0",
            )
        }
        return donationAmount
    }

    async getDonationById(id: string): Promise<Donation | null> {
        const donation = await this.donorRepository.findById(id)
        if (!donation) {
            return null
        }
        return this.mapDonationToGraphQLModel(donation)
    }

    async getDonationsByDonor(
        donorId: string,
        options?: {
            skip?: number
            take?: number
        },
    ): Promise<Donation[]> {
        const donations = await this.donorRepository.findByDonorId(
            donorId,
            options,
        )
        return donations.map(this.mapDonationToGraphQLModel)
    }

    async getMyDonationsWithTotal(
        donorId: string,
        options?: {
            skip?: number
            take?: number
        },
    ): Promise<MyDonationsResponse> {
        // Get paginated donations with payment transactions
        const donations = await this.donorRepository.findByDonorId(
            donorId,
            options,
        )

        // Get donation stats
        const stats = await this.donorRepository.getDonationStats(donorId)

        // Map donations with payment status
        const donationsWithStatus: DonationWithStatus[] = donations.map(
            (donation: any) => {
                // Get latest payment transaction
                const latestTx = donation.payment_transactions?.[0]

                return {
                    donation: this.mapDonationToGraphQLModel(donation),
                    transactionStatus: latestTx?.status || "PENDING",
                    paymentAmountStatus: latestTx?.payment_status || "PENDING",
                    amount: latestTx?.amount?.toString() || "0",
                    receivedAmount: latestTx?.received_amount?.toString() || "0",
                    orderCode: latestTx?.order_code?.toString() || "",
                }
            },
        )

        return {
            donations: donationsWithStatus,
            totalAmount: stats.totalDonated.toString(),
            totalSuccessDonations: stats.donationCount,
            totalDonatedCampaigns: stats.campaignCount,
        }
    }

    async getMyDonationDetails(
        orderCode: string,
        userId: string,
    ): Promise<MyDonationDetailsResponse> {
        // Find donation with payment_transactions
        const donation = await this.donorRepository.findByOrderCode(orderCode)

        if (!donation) {
            throw new NotFoundException(
                "Donation not found with this order code",
            )
        }

        // Verify ownership
        if (donation.donor_id !== userId) {
            throw new NotFoundException(
                "Donation not found with this order code",
            )
        }

        // Get payment transaction details (latest one)
        const latestTx = donation.payment_transactions?.[0]

        if (!latestTx) {
            throw new NotFoundException("Payment transaction not found")
        }

        const paymentTransaction: PaymentTransactionDetail = {
            id: latestTx.id,
            orderCode: latestTx.order_code?.toString() || "",
            amount: latestTx.amount.toString(),
            receivedAmount: latestTx.received_amount?.toString() || "0",
            transactionStatus: latestTx.status,
            paymentAmountStatus: latestTx.payment_status,
            description: latestTx.description || "",
            createdAt: latestTx.created_at,
            updatedAt: latestTx.updated_at,
        }

        return {
            paymentTransaction,
            donationId: donation.id,
            campaignId: donation.campaign_id,
            isAnonymous: donation.is_anonymous,
            createdAt: donation.created_at,
        }
    }

    async getMyDonationPaymentLink(
        orderCode: string,
    ): Promise<DonationPaymentLinkResponse> {
        const donation = await this.donorRepository.findByOrderCode(orderCode)

        if (!donation) {
            throw new NotFoundException(
                "Donation not found with this order code",
            )
        }

        // Get all payment transactions
        const transactions: DonationTransactionInfo[] =
            donation.payment_transactions.map((tx: any) => ({
                reference: tx.reference,
                amount: tx.amount.toString(),
                accountNumber: tx.counter_account_number,
                description: tx.description,
                transactionDateTime: tx.transaction_datetime,
            }))

        // Calculate total paid and remaining
        const totalPaid = donation.payment_transactions
            .filter((tx: any) => tx.status === "SUCCESS")
            .reduce((sum: bigint, tx: any) => sum + tx.amount, BigInt(0))

        const amountRemaining = donation.amount - totalPaid

        // Get latest payment transaction for status
        const latestTx = donation.payment_transactions[0]
        const status = latestTx?.status || "PENDING"

        // Only include banking info if status is PENDING or UNPAID
        const shouldShowBankingInfo =
            status === "PENDING" ||
            (status === "SUCCESS" && amountRemaining > BigInt(0))

        const config = envConfig().payos

        return {
            id: donation.id,
            orderCode: latestTx?.order_code?.toString() ?? undefined,
            amount: donation.amount.toString(),
            amountPaid: totalPaid.toString(),
            amountRemaining: amountRemaining.toString(),
            status,
            createdAt: donation.created_at,
            transactions,
            // Banking info - only for PENDING/UNPAID
            qrCode: shouldShowBankingInfo
                ? (latestTx?.payos_metadata as any)?.qr_code ?? undefined
                : undefined,
            bankNumber: shouldShowBankingInfo
                ? config.payosBankNumber
                : undefined,
            bankAccountName: shouldShowBankingInfo
                ? config.payosBankAccountName
                : undefined,
            bankFullName: shouldShowBankingInfo
                ? config.payosBankFullName
                : undefined,
            bankName: shouldShowBankingInfo ? config.payosBankName : undefined,
            bankLogo: shouldShowBankingInfo ? config.payosBankLogo : undefined,
            description: shouldShowBankingInfo
                ? (latestTx?.description ?? undefined)
                : undefined,
        }
    }

    async getDonationsByCampaign(
        campaignId: string,
        options?: {
            skip?: number
            take?: number
            filter?: {
                searchDonorName?: string
                sortBy?: string
                sortOrder?: string
            }
        },
    ): Promise<CampaignDonationSummary[]> {
        this.logger.log("=== getDonationsByCampaign SERVICE DEBUG ===")
        this.logger.log(`campaignId: ${campaignId}`)
        this.logger.log(`options: ${JSON.stringify(options, null, 2)}`)
        this.logger.log(`filter: ${JSON.stringify(options?.filter, null, 2)}`)
        this.logger.log("===========================================")
        
        // Query Payment_Transaction directly for transparency
        // Shows all individual payments (initial + supplementary)
        const paymentTransactions =
            await this.donorRepository.findPaymentTransactionsByCampaignId(
                campaignId,
                {
                    skip: options?.skip,
                    take: options?.take,
                    searchDonorName: options?.filter?.searchDonorName,
                },
            )

        // Map to summary DTO with donor name from donation
        const summaries = paymentTransactions.map((payment: any) => {
            // Get donor name from donation
            let donorName = "Unknown Donor"
            if (payment.donation) {
                if (
                    payment.donation.is_anonymous ||
                    payment.donation.donor_id === "anonymous"
                ) {
                    donorName = "Người dùng ẩn danh"
                } else if (payment.donation.donor_name) {
                    donorName = payment.donation.donor_name
                }
            }

            return {
                amount: payment.received_amount.toString(),
                donorName: donorName,
                transactionDatetime: payment.transaction_datetime || payment.created_at,
            }
        })

        // Apply sorting
        const sortBy = options?.filter?.sortBy || "TRANSACTION_DATE"
        const sortOrder = options?.filter?.sortOrder || "DESC"

        summaries.sort((a: any, b: any) => {
            let compareValue = 0

            switch (sortBy) {
            case "AMOUNT":
                compareValue = Number(a.amount) - Number(b.amount)
                break
            case "TRANSACTION_DATE":
            case "CREATED_AT":
                compareValue =
                        new Date(a.transactionDatetime).getTime() -
                        new Date(b.transactionDatetime).getTime()
                break
            default:
                compareValue = 0
            }

            return sortOrder === "ASC" ? compareValue : -compareValue
        })

        return summaries
    }

    async getDonationStats(donorId: string): Promise<{
        totalDonated: string
        donationCount: number
        campaignCount: number
    }> {
        const stats = await this.donorRepository.getDonationStats(donorId)
        return {
            totalDonated: stats.totalDonated.toString(),
            donationCount: stats.donationCount,
            campaignCount: stats.campaignCount,
        }
    }

    async getCampaignDonationStats(campaignId: string): Promise<{
        totalAmount: string
        donationCount: number
    }> {
        const stats =
            await this.donorRepository.getTotalDonationsByCampaign(campaignId)
        return {
            totalAmount: stats.totalAmount.toString(),
            donationCount: stats.donationCount,
        }
    }

    private mapDonationToGraphQLModel(donation: any): Donation {
        // Get transaction_datetime from successful payment transaction
        const successfulTx = donation.payment_transactions?.find(
            (tx: any) => tx.status === "SUCCESS",
        )

        // Get latest payment transaction for status and orderCode
        const latestTx = donation.payment_transactions?.[0]

        return {
            id: donation.id,
            donorId: donation.donor_id,
            donorName: donation.donor_name,
            campaignId: donation.campaign_id,
            amount: donation.amount.toString(),
            isAnonymous: donation.is_anonymous ?? false,
            status: latestTx?.status || "PENDING",
            orderCode: latestTx?.order_code?.toString() || null,
            transactionDatetime: successfulTx?.transaction_datetime || null,
            created_at: donation.created_at,
            updated_at: donation.updated_at,
        }
    }

    /**
     * DEPRECATED: This method is no longer used with PayOS
     * Use createDonation to generate payment link instead
     */
    async getCampaignDonationInfo(
        campaignId: string,
        user: CurrentUserType | null,
        isAnonymous?: boolean,
    ): Promise<CampaignDonationInfo> {
        throw new BadRequestException(
            "This endpoint is deprecated. Please use createDonation mutation to generate payment link.",
        )
    }

    /**
     * Get campaign donation statement for CSV export
     * Returns detailed transaction information for public transparency
     */
    async getCampaignDonationStatement(
        campaignId: string,
    ): Promise<CampaignDonationStatementResponse> {
        // Fetch campaign info
        const campaign = await this.campaignRepository.findById(campaignId)

        if (!campaign) {
            throw new NotFoundException("Campaign not found")
        }

        // Fetch all donations with successful payment transactions
        const donations = await this.donorRepository.findByCampaignId(
            campaignId,
            {
                skip: 0,
                take: 10000, // Get all donations (reasonable limit)
            },
        )

        // Filter only donations with successful payments
        const successfulDonations = donations.filter((donation: any) => {
            return donation.payment_transactions?.some(
                (tx: any) => tx.status === "SUCCESS",
            )
        })

        // Fetch donor names using DataLoader
        const donorIdsToFetch = successfulDonations
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

        // Map to transaction statements
        const transactions: DonationTransactionStatement[] = []
        let totalReceived = BigInt(0)

        for (const donation of successfulDonations) {
            const donationWithTx = donation as any // Cast to access payment_transactions

            // Get donor name
            let donorName = "Người dùng ẩn danh"
            if (
                !donationWithTx.is_anonymous &&
                donationWithTx.donor_id !== "anonymous"
            ) {
                donorName =
                    donationWithTx.donor_name ||
                    userNameMap.get(donationWithTx.donor_id) ||
                    "Unknown Donor"
            }

            // Process all successful payment transactions
            const successfulTxs = donationWithTx.payment_transactions.filter(
                (tx: any) => tx.status === "SUCCESS",
            )

            for (const tx of successfulTxs) {
                totalReceived += tx.received_amount

                // Extract bank info from metadata
                let bankAccountNumber: string | undefined
                let bankName: string | undefined
                let description: string | undefined

                if (tx.gateway === "PAYOS" && tx.payos_metadata) {
                    const metadata = tx.payos_metadata as any
                    bankAccountNumber = metadata.counter_account_number
                    bankName = metadata.counter_account_bank_name
                    description = tx.description
                } else if (tx.gateway === "SEPAY" && tx.sepay_metadata) {
                    const metadata = tx.sepay_metadata as any
                    bankAccountNumber = metadata.sub_account
                    bankName = metadata.bank_name
                    description = metadata.content || metadata.description
                }

                transactions.push({
                    donationId: donationWithTx.id,
                    transactionDateTime: tx.transaction_datetime
                        ? new Date(tx.transaction_datetime).toISOString()
                        : new Date(tx.created_at).toISOString(),
                    donorName,
                    amount: tx.amount.toString(),
                    receivedAmount: tx.received_amount.toString(),
                    transactionStatus: tx.status,
                    paymentStatus: tx.payment_status,
                    gateway: tx.gateway || "UNKNOWN",
                    orderCode: tx.order_code?.toString() || "",
                    bankAccountNumber,
                    bankName,
                    description,
                    campaignId: campaign.id,
                    campaignTitle: campaign.title,
                })
            }
        }

        // Sort by transaction date (newest first)
        transactions.sort(
            (a, b) =>
                new Date(b.transactionDateTime).getTime() -
                new Date(a.transactionDateTime).getTime(),
        )

        return {
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            totalReceived: totalReceived.toString(),
            totalDonations: transactions.length,
            generatedAt: new Date().toISOString(),
            transactions,
        }
    }
}
