import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common"
import { CampaignStatus } from "./enums/campaign.enums"
import { Campaign } from "./models/campaign.model"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    UpdateCampaignInput,
} from "./dtos/campaign.input"
import { SentryService } from "@libs/observability/sentry.service"
import { CampaignRepository } from "./campaign.repository"

@Injectable()
export class CampaignService {
    private readonly logger = new Logger(CampaignService.name)

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly sentryService: SentryService,
    ) {}

    async createCampaign(
        input: CreateCampaignInput,
        createdBy: string,
    ): Promise<Campaign> {
        try {
            if (!createdBy) {
                throw new UnauthorizedException(
                    "User authentication required to create campaign",
                )
            }
            this.validateCampaignDates(input.startDate, input.endDate)
            this.validateTargetAmount(input.targetAmount)

            if (input.coverImage && !this.isValidImageUrl(input.coverImage)) {
                throw new BadRequestException(
                    "Invalid cover image URL provided. Must be a valid HTTP/HTTPS URL.",
                )
            }

            const campaign = await this.campaignRepository.create({
                ...input,
                createdBy,
                status: CampaignStatus.PENDING,
            })
            this.sentryService.addBreadcrumb("Campaign created", "campaign", {
                campaignId: campaign.id,
                createdBy,
                status: CampaignStatus.PENDING,
                title: input.title,
            })

            return campaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createCampaign",
                createdBy,
                input: {
                    title: input.title,
                    targetAmount: input.targetAmount,
                    location: input.location,
                    startDate: input.startDate?.toString(),
                    endDate: input.endDate?.toString(),
                    startDateType: typeof input.startDate,
                    endDateType: typeof input.endDate,
                },
                authenticated: !!createdBy,
            })
            throw error
        }
    }

    async updateCampaign(
        id: string,
        input: UpdateCampaignInput,
        userId: string,
    ): Promise<Campaign> {
        try {
            if (!userId) {
                throw new UnauthorizedException(
                    "User authentication required to update campaign",
                )
            }
            const campaign = await this.findCampaignById(id)
            this.validateCampaignOwnership(campaign, userId)
            this.validateCampaignForUpdate(campaign)
            if (input.startDate || input.endDate) {
                const startDate = input.startDate || campaign.startDate
                const endDate = input.endDate || campaign.endDate
                this.validateCampaignDates(startDate, endDate)
            }
            if (input.targetAmount) {
                this.validateTargetAmount(input.targetAmount)
            }
            if (input.coverImage && !this.isValidImageUrl(input.coverImage)) {
                throw new BadRequestException(
                    "Invalid cover image URL provided",
                )
            }
            const updatedCampaign = await this.campaignRepository.update(
                id,
                input,
            )
            return updatedCampaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaign",
                campaignId: id,
                userId,
                input,
                authenticated: !!userId,
            })
            throw error
        }
    }

    async changeStatus(
        id: string,
        newStatus: CampaignStatus,
        userId: string,
    ): Promise<Campaign> {
        try {
            if (!userId) {
                this.logger.error(
                    `Campaign status change attempted without user authentication for campaign: ${id}`,
                )
                throw new UnauthorizedException(
                    "User authentication required to change campaign status",
                )
            }
            const campaign = await this.findCampaignById(id)
            this.validateStatusTransition(campaign.status, newStatus)
            this.validateCampaignOwnership(campaign, userId)

            const updatedData: any = { status: newStatus }

            if (newStatus === CampaignStatus.APPROVED) {
                updatedData.approvedAt = new Date()
            }

            const updatedCampaign = await this.campaignRepository.update(
                id,
                updatedData,
            )

            return updatedCampaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "changeStatus",
                campaignId: id,
                userId,
                newStatus,
                authenticated: !!userId,
            })
            throw error
        }
    }

    async getCampaigns(
        filter?: CampaignFilterInput,
        search?: string,
        sortBy: CampaignSortOrder = CampaignSortOrder.ACTIVE_FIRST,
        limit: number = 10,
        offset: number = 0,
    ): Promise<Campaign[]> {
        try {
            return await this.campaignRepository.findMany({
                filter,
                search,
                sortBy,
                limit,
                offset,
            })
        } catch (error) {
            this.logger.error("Failed to get campaigns:", error)
            this.sentryService.captureError(error as Error, {
                operation: "getCampaigns",
                filter,
                search,
                sortBy,
                limit,
                offset,
            })
            throw error
        }
    }

    async findCampaignById(id: string): Promise<Campaign> {
        try {
            const campaign = await this.campaignRepository.findById(id)
            if (!campaign) {
                throw new NotFoundException(`Campaign with ID ${id} not found`)
            }
            return campaign
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.logger.error(`Failed to find campaign ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "findCampaignById",
                campaignId: id,
            })
            throw error
        }
    }

    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<Campaign> {
        this.logger.log(`Resolving Campaign reference: ${reference.id}`)
        return this.findCampaignById(reference.id)
    }

    private validateCampaignDates(startDate: Date, endDate: Date): void {
        if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
            throw new BadRequestException(
                "Start date and end date must be valid Date objects"
            )
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new BadRequestException(
                "Start date and end date must be valid dates"
            )
        }

        const now = new Date()
        const start = new Date(startDate)
        const end = new Date(endDate)

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

        if (startDay < today) {
            throw new BadRequestException(
                "Start date cannot be in the past. Please select today or a future date."
            )
        }

        if (endDay <= startDay) {
            throw new BadRequestException(
                "End date must be after the start date. Please ensure there's at least one day between start and end dates."
            )
        }

        const maxDurationMs = 365 * 24 * 60 * 60 * 1000
        const durationMs = end.getTime() - start.getTime()
    
        if (durationMs > maxDurationMs) {
            throw new BadRequestException(
                "Campaign duration cannot exceed 1 year. Please select an end date within one year of the start date."
            )
        }

        const minDurationMs = 24 * 60 * 60 * 1000 
        if (durationMs < minDurationMs) {
            throw new BadRequestException(
                "Campaign must run for at least 1 day. Please ensure there's adequate time between start and end dates."
            )
        }
    }

    private validateTargetAmount(targetAmount: string): void {
        try {
            if (!targetAmount || typeof targetAmount !== "string") {
                throw new BadRequestException(
                    "Target amount is required and must be a string",
                )
            }

            const amount = BigInt(targetAmount)
            const minAmount = BigInt("10000")
            const maxAmount = BigInt("10000000000")

            if (amount < minAmount) {
                throw new BadRequestException(
                    "Target amount must be at least 10,000 VND (approximately $0.40 USD)",
                )
            }

            if (amount > maxAmount) {
                throw new BadRequestException(
                    "Target amount cannot exceed 10 billion VND (approximately $400,000 USD)",
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Invalid target amount format. Please provide a valid numeric string.",
            )
        }
    }

    private validateStatusTransition(
        currentStatus: CampaignStatus,
        newStatus: CampaignStatus,
    ): void {
        const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
            [CampaignStatus.PENDING]: [
                CampaignStatus.APPROVED,
                CampaignStatus.REJECTED,
            ],
            [CampaignStatus.APPROVED]: [CampaignStatus.ACTIVE],
            [CampaignStatus.ACTIVE]: [
                CampaignStatus.COMPLETED,
                CampaignStatus.CANCELLED,
            ],
            [CampaignStatus.REJECTED]: [],
            [CampaignStatus.COMPLETED]: [],
            [CampaignStatus.CANCELLED]: [],
        }

        const allowedTransitions = validTransitions[currentStatus] || []

        if (!allowedTransitions.includes(newStatus)) {
            throw new BadRequestException(
                `Invalid status transition from ${currentStatus} to ${newStatus}`,
            )
        }
    }

    private validateCampaignOwnership(
        campaign: Campaign,
        userId: string,
    ): void {
        if (campaign.createdBy !== userId) {
            throw new ForbiddenException(
                "Only campaign creator can perform this action",
            )
        }
    }

    private validateCampaignForUpdate(campaign: Campaign): void {
        const nonEditableStatuses = [
            CampaignStatus.APPROVED,
            CampaignStatus.REJECTED,
            CampaignStatus.ACTIVE,
            CampaignStatus.COMPLETED,
            CampaignStatus.CANCELLED,
        ]

        if (nonEditableStatuses.includes(campaign.status)) {
            throw new ForbiddenException(
                `Cannot modify campaign in ${campaign.status} status`,
            )
        }
    }

    private isValidImageUrl(url: string): boolean {
        try {
            const validUrl = new URL(url)
            if (!["http:", "https:"].includes(validUrl.protocol)) {
                return false
            }
            if (!validUrl.hostname || validUrl.hostname.length < 3) {
                return false
            }

            if (process.env.NODE_ENV === "production") {
                const hostname = validUrl.hostname.toLowerCase()
                const blockedHosts = [
                    "localhost",
                    "127.0.0.1",
                    "0.0.0.0",
                    "::1",
                    "10.",
                    "172.",
                    "192.168.",
                ]

                if (
                    blockedHosts.some((blocked) => hostname.includes(blocked))
                ) {
                    return false
                }
            }
            return true
        } catch {
            return false
        }
    }

    async checkDatabaseHealth(): Promise<{
        status: string
        timestamp: string
    }> {
        try {
            const healthResult = await this.campaignRepository.healthCheck()
            return healthResult
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "checkDatabaseHealth",
                service: "campaign-service",
            })
            throw error
        }
    }

    getHealth() {
        return {
            status: "healthy",
            service: "Campaign Service",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            uptime: process.uptime(),
        }
    }
}
