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
import { SepayService } from "@libs/sepay"
import { CurrentUserType } from "@libs/auth"
import { encodeDonationDescription } from "@libs/common"
import { v7 as uuidv7 } from "uuid"

@Injectable()
export class DonorService {
    private readonly logger = new Logger(DonorService.name)

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly sqsService: SqsService,
        private readonly sepayService: SepayService,
    ) {}

    /**
     * DEPRECATED: This method is no longer used
     * Use getCampaignDonationInfo to get static QR code instead
     * Donations are auto-created by Sepay webhook
     */
    async createDonation(
        input: CreateDonationInput,
        user: CurrentUserType | null,
    ): Promise<DonationResponse> {
        throw new BadRequestException(
            "This endpoint is deprecated. Please use getCampaignDonationInfo to get QR code and scan to donate.",
        )
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
        },
    ): Promise<Donation[]> {
        const donations = await this.donorRepository.findByCampaignId(
            campaignId,
            options,
        )
        return donations.map(this.mapDonationToGraphQLModel)
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
        return {
            id: donation.id,
            donorId: donation.donor_id,
            campaignId: donation.campaign_id,
            amount: donation.amount.toString(),
            message: donation.message,
            isAnonymous: donation.is_anonymous ?? false,
            created_at: donation.created_at,
            updated_at: donation.updated_at,
        }
    }

    async getCampaignDonationInfo(
        campaignId: string,
        user: CurrentUserType | null,
        isAnonymous?: boolean,
    ): Promise<CampaignDonationInfo> {
        // Validate campaign
        await this.validateCampaignForDonation(campaignId)

        const shouldIncludeUserId = !!user && !isAnonymous

        const transferDescription = encodeDonationDescription({
            campaignId,
            userId: shouldIncludeUserId ? user.sub : undefined,
        })

        // Get Sepay account info
        const accountInfo = this.sepayService.getAccountInfo()

        this.logger.log(
            `[SEPAY] Generated donation info for campaign ${campaignId}`,
            {
                isAuthenticated: !!user,
                isAnonymous: !shouldIncludeUserId,
                userId: shouldIncludeUserId ? user.sub : "anonymous",
                description: transferDescription,
            },
        )

        return {
            bankAccountNumber: accountInfo.account_number,
            bankAccountName: accountInfo.account_name,
            bankName: accountInfo.bank_name,
            bankCode: accountInfo.bank_code,
            transferDescription,
            isAuthenticated: !!user,
        }
    }
}
