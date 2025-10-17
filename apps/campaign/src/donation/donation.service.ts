import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { DonationRepository } from "./donation.repository"
import { CreateDonationInput } from "./dtos/create-donation.input"
import { CreateDonationRepositoryInput } from "./dtos/create-donation-repository.input"
import { CampaignRepository } from "../campaign/campaign.repository"
import { CampaignStatus } from "../campaign/enum/campaign.enum"
import { Donation } from "./models/donation.model"

@Injectable()
export class DonationService {
    constructor(
        private readonly donationRepository: DonationRepository,
        private readonly campaignRepository: CampaignRepository,
    ) {}

    async createDonation(
        input: CreateDonationInput,
        cognitoId: string,
    ): Promise<Donation> {
        // Validate campaign exists and is active
        const campaign = await this.campaignRepository.findById(input.campaignId)
        
        if (!campaign) {
            throw new NotFoundException("Campaign not found")
        }

        if (!campaign.isActive) {
            throw new BadRequestException("Campaign is not active")
        }

        // Check campaign status - only allow donations for active campaigns
        if (campaign.status !== CampaignStatus.ACTIVE) {
            throw new BadRequestException(
                `Cannot donate to campaign with status: ${campaign.status}. Campaign must be ACTIVE.`
            )
        }

        // Check if campaign fundraising is within date range
        const now = new Date()
        if (now < campaign.fundraisingStartDate) {
            throw new BadRequestException("Fundraising has not started yet")
        }

        if (now > campaign.fundraisingEndDate) {
            throw new BadRequestException("Fundraising period has ended")
        }

        // Validate donation amount
        const donationAmount = BigInt(input.amount)
        if (donationAmount <= 0) {
            throw new BadRequestException("Donation amount must be greater than 0")
        }

        // Create donation
        const donationData: CreateDonationRepositoryInput = {
            donor_id: cognitoId,
            campaign_id: input.campaignId,
            amount: donationAmount,
            message: input.message,
            is_anonymous: input.isAnonymous ?? false,
        }

        const createdDonation = await this.donationRepository.create(donationData)

        // Convert to GraphQL model
        return this.mapDonationToGraphQLModel(createdDonation)
    }

    async getDonationById(id: string): Promise<Donation | null> {
        const donation = await this.donationRepository.findById(id)
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
        }
    ): Promise<Donation[]> {
        const donations = await this.donationRepository.findByDonorId(donorId, options)
        return donations.map(this.mapDonationToGraphQLModel)
    }

    async getDonationsByCampaign(
        campaignId: string,
        options?: {
            skip?: number
            take?: number
        }
    ): Promise<Donation[]> {
        const donations = await this.donationRepository.findByCampaignId(campaignId, options)
        return donations.map(this.mapDonationToGraphQLModel)
    }

    async getDonationStats(donorId: string): Promise<{
        totalDonated: string
        donationCount: number
        campaignCount: number
    }> {
        const stats = await this.donationRepository.getDonationStats(donorId)
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
        const stats = await this.donationRepository.getTotalDonationsByCampaign(campaignId)
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
            paymentReference: donation.payment_reference,
            isAnonymous: donation.is_anonymous,
            created_at: donation.created_at,
            updated_at: donation.updated_at,
        }
    }
}