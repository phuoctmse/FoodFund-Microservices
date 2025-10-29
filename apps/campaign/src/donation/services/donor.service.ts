import {
    Injectable,
    BadRequestException,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { DonorRepository } from "../repositories/donor.repository"
import { CreateDonationInput } from "../dtos/create-donation.input"
import { DonationResponse } from "../dtos/donation-response.dto"
import { CampaignDonationInfo } from "../dtos/campaign-donation-info.dto"
import { CampaignRepository } from "../../campaign/campaign.repository"
import { CampaignStatus } from "../../campaign/enum/campaign.enum"
import { Donation } from "../models/donation.model"
import { SqsService } from "@libs/aws-sqs"
import { CurrentUserType } from "@libs/auth"
import { UserClientService } from "../../shared/services/user-client.service"
import { UserDataLoader } from "../../shared/dataloaders/user.dataloader"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"

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

        // Generate unique order code (timestamp-based)
        const orderCode = Number(Date.now())

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
    ): Promise<Donation[]> {
        const donations = await this.donorRepository.findByCampaignId(
            campaignId,
            options,
        )

        // Filter and validate donations
        const validDonations = donations.filter((donation: any) => {
            // Must have at least one successful payment transaction
            const successfulTx = donation.payment_transactions?.find(
                (tx: any) => tx.status === "SUCCESS",
            )
            if (!successfulTx) return false

            // Validate amount matches between donation and transaction
            if (donation.amount !== successfulTx.amount) {
                this.logger.warn(
                    `Donation ${donation.id} amount mismatch: donation=${donation.amount}, transaction=${successfulTx.amount}`,
                )
                return false
            }

            return true
        })

        // Use DataLoader to batch fetch donor names (automatic batching & caching)
        // Collect donor IDs that need to be fetched
        const donorIdsToFetch = validDonations
            .filter(
                (d: any) =>
                    !d.donor_name &&
                    !d.is_anonymous &&
                    d.donor_id !== "anonymous",
            )
            .map((d: any) => d.donor_id)

        // Get unique donor IDs
        const uniqueDonorIds = [...new Set(donorIdsToFetch)]

        // Batch fetch using DataLoader (automatically batches and caches)
        const users =
            uniqueDonorIds.length > 0
                ? await this.userDataLoader.loadMany(uniqueDonorIds)
                : []

        // Build map for quick lookup
        const userNameMap = new Map<string, string>()
        users.forEach((user, index) => {
            if (user) {
                const userName =
                    user.fullName || user.username || "Unknown Donor"
                userNameMap.set(uniqueDonorIds[index], userName)
            }
        })

        // Populate donor_name for all donations
        let donationsWithNames = validDonations.map((donation: any) => {
            if (!donation.donor_name) {
                // Anonymous donations
                if (
                    donation.is_anonymous ||
                    donation.donor_id === "anonymous"
                ) {
                    donation.donor_name = "Người dùng ẩn danh"
                } else {
                    // Get from DataLoader fetched map
                    donation.donor_name =
                        userNameMap.get(donation.donor_id) || "Unknown Donor"
                }
            }
            return donation
        })

        // Apply search filter
        if (options?.filter?.searchDonorName) {
            const searchTerm = options.filter.searchDonorName.toLowerCase()
            donationsWithNames = donationsWithNames.filter((donation: any) =>
                donation.donor_name?.toLowerCase().includes(searchTerm),
            )
        }

        // Apply sorting
        const sortBy = options?.filter?.sortBy || "transactionDate"
        const sortOrder = options?.filter?.sortOrder || "desc"

        donationsWithNames.sort((a: any, b: any) => {
            let compareValue = 0

            switch (sortBy) {
            case "amount":
                compareValue = Number(a.amount) - Number(b.amount)
                break
            case "transactionDate": {
                const aDate =
                        a.payment_transactions?.find(
                            (tx: any) => tx.status === "SUCCESS",
                        )?.transaction_datetime || a.created_at
                const bDate =
                        b.payment_transactions?.find(
                            (tx: any) => tx.status === "SUCCESS",
                        )?.transaction_datetime || b.created_at
                compareValue =
                        new Date(aDate).getTime() - new Date(bDate).getTime()
                break
            }
            case "createdAt":
                compareValue =
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                break
            default:
                compareValue = 0
            }

            return sortOrder === "asc" ? compareValue : -compareValue
        })

        return donationsWithNames.map(this.mapDonationToGraphQLModel)
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

        return {
            id: donation.id,
            donorId: donation.donor_id,
            donorName: donation.donor_name,
            campaignId: donation.campaign_id,
            amount: donation.amount.toString(),
            isAnonymous: donation.is_anonymous ?? false,
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
}
