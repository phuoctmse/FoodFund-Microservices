import {
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
} from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignCacheService } from "./campaign-cache.service"
import { CampaignRepository } from "../../repositories/campaign.repository"
import { CampaignCategoryRepository } from "../../repositories/campaign-category.repository"
import { CampaignPhaseRepository } from "../../repositories/campaign-phase.repository"
import {
    AuthorizationService,
    PhaseBudgetValidator,
    Role,
    UserContext,
} from "@app/campaign/src/shared"
import { CampaignPhaseService } from "../campaign-phase/campaign-phase.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    ExtendCampaignInput,
    GenerateUploadUrlInput,
    UpdateCampaignInput,
} from "../../dtos/campaign/request"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import {
    CampaignCannotBeDeletedException,
    CampaignNotFoundException,
} from "@app/campaign/src/domain/exceptions/campaign/campaign.exception"
import { CampaignStatsFilterInput } from "../../dtos/campaign/request/campaign-stats-filter.input"
import {
    CampaignCategoryStats,
    CampaignFinancialStats,
    CampaignOverviewStats,
    CampaignPerformanceStats,
    CampaignStatsResponse,
    CampaignStatusBreakdown,
    CampaignTimeRangeStats,
} from "../../dtos/campaign/response/campaign-stats.response"

interface CoverImageUpdateResult {
    updateData: {
        coverImage?: string
        coverImageFileKey?: string
    }
    oldFileKeyToDelete: string | null
}

@Injectable()
export class CampaignService {
    private readonly SPACES_CDN_ENDPOINT = process.env.SPACES_CDN_ENDPOINT
    private readonly resource = "campaigns"

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly campaignCategoryRepository: CampaignCategoryRepository,
        private readonly campaignPhaseRepository: CampaignPhaseRepository,
        private readonly sentryService: SentryService,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly authorizationService: AuthorizationService,
        private readonly cacheService: CampaignCacheService,
        @Inject(forwardRef(() => CampaignPhaseService))
        private readonly phaseService: CampaignPhaseService,
    ) {}

    async generateCampaignImageUploadUrl(
        input: GenerateUploadUrlInput,
        userContext: UserContext,
    ): Promise<{
        uploadUrl: string
        fileKey: string
        expiresAt: Date
        cdnUrl: string
        instructions: string
    }> {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "generate upload URL",
            )

            if (input.campaignId) {
                const campaign = await this.findCampaignById(input.campaignId)
                this.authorizationService.requireOwnership(
                    campaign.createdBy,
                    userContext,
                    "campaign",
                    "generate upload URL",
                )
            }

            const result =
                await this.spacesUploadService.generateImageUploadUrl(
                    userContext.userId,
                    this.resource,
                    input.campaignId,
                )

            return {
                ...result,
                instructions:
                    "Upload your image file to the uploadUrl using PUT method with Content-Type: image/jpeg. Then use the fileKey in createCampaign mutation.",
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "generateCampaignImageUploadUrl",
                user: {
                    id: userContext.userId,
                    role: userContext.role,
                },
                campaignId: input.campaignId,
            })
            throw error
        }
    }

    async createCampaign(
        input: CreateCampaignInput,
        userContext: UserContext,
    ): Promise<Campaign> {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "create campaign",
            )

            this.authorizationService.requireRole(
                userContext,
                Role.FUNDRAISER,
                "create campaign",
            )

            // await this.validateNoActiveCampaign(userContext.userId)

            if (input.categoryId) {
                await this.validateCategoryExists(input.categoryId)
            }

            const fileValidation =
                await this.spacesUploadService.validateUploadedFile(
                    input.coverImageFileKey,
                )

            if (!fileValidation.exists) {
                throw new BadRequestException(
                    "Cover image file not found. Please upload the file first using generateUploadUrl.",
                )
            }

            const fileKey = this.spacesUploadService.extractFileKeyFromUrl(
                this.resource,
                input.coverImageFileKey,
            )

            if (!fileKey?.startsWith(`${this.resource}/`)) {
                throw new BadRequestException(
                    "Invalid file key. Please use a valid file key from generateCampaignImageUploadUrl.",
                )
            }

            this.validateCampaignDates(
                input.fundraisingStartDate,
                input.fundraisingEndDate,
            )
            const targetAmountBigInt = this.parseAndValidateTargetAmount(
                input.targetAmount,
            )

            if (!input.phases || input.phases.length === 0) {
                throw new BadRequestException(
                    "At least one campaign phase is required",
                )
            }

            PhaseBudgetValidator.validate(input.phases)

            this.phaseService.validatePhaseDates(
                input.phases,
                input.fundraisingEndDate,
            )

            const cdnUrl = `${this.SPACES_CDN_ENDPOINT}/${fileKey}`

            const campaign = await this.campaignRepository.create({
                title: input.title,
                description: input.description,
                coverImage: cdnUrl,
                coverImageFileKey: fileKey,
                targetAmount: targetAmountBigInt,
                fundraisingStartDate: input.fundraisingStartDate,
                fundraisingEndDate: input.fundraisingEndDate,
                createdBy: userContext.userId,
                status: CampaignStatus.PENDING,
                categoryId: input.categoryId,
                phases: input.phases.map((phase) => ({
                    phaseName: phase.phaseName,
                    location: phase.location,
                    ingredientPurchaseDate: phase.ingredientPurchaseDate,
                    cookingDate: phase.cookingDate,
                    deliveryDate: phase.deliveryDate,
                    ingredientBudgetPercentage: Number.parseFloat(
                        phase.ingredientBudgetPercentage,
                    ),
                    cookingBudgetPercentage: Number.parseFloat(
                        phase.cookingBudgetPercentage,
                    ),
                    deliveryBudgetPercentage: Number.parseFloat(
                        phase.deliveryBudgetPercentage,
                    ),
                })),
            })

            await this.cacheService.setCampaign(campaign.id, campaign)

            await this.cacheService.invalidateAll(
                campaign.id,
                userContext.userId,
                input.categoryId,
            )

            return campaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createCampaign",
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
                input: {
                    title: input.title,
                    categoryId: input.categoryId,
                },
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
    ) {
        try {
            const cacheParams = { filter, search, sortBy, limit, offset }
            const cached = await this.cacheService.getCampaignList(cacheParams)

            if (cached) {
                return cached
            }

            const campaigns = await this.campaignRepository.findMany({
                filter,
                search,
                sortBy,
                limit,
                offset,
            })

            await this.cacheService.setCampaignList(cacheParams, campaigns)

            return campaigns
        } catch (error) {
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

    async findCampaignById(id: string) {
        const cached = await this.cacheService.getCampaign(id)
        if (cached) {
            return cached
        }

        const campaign = await this.campaignRepository.findById(id)
        if (campaign == null) {
            throw new CampaignNotFoundException(id)
        }

        await this.cacheService.setCampaign(id, campaign)
        return campaign
    }

    async getCampaignIdByPhaseId(phaseId: string): Promise<string | null> {
        return this.campaignPhaseRepository.getCampaignIdByPhaseId(phaseId)
    }

    async updateCampaign(
        id: string,
        input: UpdateCampaignInput,
        userContext: UserContext,
    ): Promise<Campaign> {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "update campaign",
            )

            const campaign = await this.findCampaignById(id)

            this.authorizationService.requireOwnership(
                campaign.createdBy,
                userContext,
                "campaign",
                "update",
            )

            this.validateCampaignForUpdate(campaign)

            if (input.categoryId) {
                await this.validateCategoryExists(input.categoryId)
            }

            const updateData: any = {}

            const coverImageResult = await this.processCoverImageUpdate(
                input.coverImageFileKey,
                campaign,
            )
            Object.assign(updateData, coverImageResult.updateData)

            this.processFundraisingDatesUpdate(input, campaign, updateData)
            this.processBasicFieldUpdates(input, updateData)
            this.handleStatusReversion(campaign, updateData)

            const updatedCampaign = await this.campaignRepository.update(
                id,
                updateData,
            )

            await this.updateCampaignCache(
                id,
                updatedCampaign,
                userContext.userId,
                campaign.categoryId,
                input.categoryId,
            )

            if (coverImageResult.oldFileKeyToDelete) {
                await this.spacesUploadService.deleteResourceImage(
                    coverImageResult.oldFileKeyToDelete,
                )
            }

            return updatedCampaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaign",
                campaignId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }

    async changeStatus(
        id: string,
        newStatus: CampaignStatus,
        userContext: UserContext,
    ) {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "change campaign status",
            )

            const campaign = await this.findCampaignById(id)
            this.authorizationService.requireAdmin(
                userContext,
                "change campaign status",
            )
            this.validateStatusTransition(campaign.status, newStatus)

            const updateData: any = {
                status: newStatus,
                changedStatusAt: new Date(),
            }

            if (
                campaign.status === CampaignStatus.PENDING &&
                newStatus === CampaignStatus.APPROVED
            ) {
                const today = new Date()
                const startDate = new Date(campaign.fundraisingStartDate)

                const todayNormalized = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                )
                const startDateNormalized = new Date(
                    startDate.getFullYear(),
                    startDate.getMonth(),
                    startDate.getDate(),
                )

                if (
                    startDateNormalized.getTime() === todayNormalized.getTime()
                ) {
                    updateData.status = CampaignStatus.ACTIVE
                    updateData.changedStatusAt = new Date()
                } else {
                    updateData.changedStatusAt = new Date()
                }
            } else if (newStatus === CampaignStatus.APPROVED) {
                updateData.changedStatusAt = new Date()
            } else if (newStatus === CampaignStatus.COMPLETED) {
                updateData.completedAt = new Date()
            }

            const updatedCampaign = await this.campaignRepository.update(
                id,
                updateData,
            )

            await this.cacheService.setCampaign(id, updatedCampaign)

            await this.cacheService.invalidateAll(
                id,
                campaign.createdBy,
                campaign.categoryId,
            )

            return updatedCampaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "changeStatus",
                campaignId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
                requestedStatus: newStatus,
            })
            throw error
        }
    }

    async extendCampaign(
        id: string,
        input: ExtendCampaignInput,
        userContext: UserContext,
    ): Promise<Campaign> {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "extend campaign",
            )

            const campaign = await this.findCampaignById(id)

            if (campaign.createdBy !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only extend campaigns you created",
                )
            }

            if (campaign.status !== CampaignStatus.ACTIVE) {
                throw new BadRequestException(
                    `Only ACTIVE campaigns can be extended. Current status: ${campaign.status}`,
                )
            }

            if (campaign.extensionCount >= 1) {
                throw new BadRequestException(
                    "Campaign can only be extended once",
                )
            }

            const now = new Date()
            const endDate = new Date(campaign.fundraisingEndDate)
            const daysToEnd =
                (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

            if (daysToEnd > 7) {
                throw new BadRequestException(
                    `Can only extend campaign within 7 days of end date. Currently ${Math.ceil(daysToEnd)} days remaining.`,
                )
            }

            if (daysToEnd < 0) {
                throw new BadRequestException(
                    "Campaign has already ended. Cannot extend.",
                )
            }

            const newEndDate = new Date(endDate)
            newEndDate.setDate(newEndDate.getDate() + input.extensionDays)

            const updatedCampaign =
                await this.campaignRepository.extendCampaignWithPhases({
                    campaignId: id,
                    extensionDays: input.extensionDays,
                    newFundraisingEndDate: newEndDate,
                })

            await Promise.all([
                this.cacheService.deleteCampaign(id),
                this.cacheService.invalidateAll(
                    id,
                    userContext.userId,
                    campaign.categoryId,
                ),
            ])

            return updatedCampaign
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "extendCampaign",
                campaignId: id,
                extensionDays: input.extensionDays,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }

    async deleteCampaign(
        id: string,
        userContext: UserContext,
    ): Promise<boolean> {
        try {
            this.authorizationService.requireAuthentication(
                userContext,
                "delete campaign",
            )

            const campaign = await this.findCampaignById(id)

            this.authorizationService.requireOwnership(
                campaign.createdBy,
                userContext,
                "campaign",
                "delete",
            )

            const deletableStatuses = [
                CampaignStatus.PENDING,
                CampaignStatus.APPROVED,
                CampaignStatus.REJECTED,
            ]

            if (!deletableStatuses.includes(campaign.status)) {
                throw new CampaignCannotBeDeletedException(campaign.status)
            }

            const result = await this.campaignRepository.delete(id)

            if (!result) {
                throw new BadRequestException(`Failed to delete campaign ${id}`)
            }

            await this.cacheService.deleteCampaign(id)

            await this.cacheService.invalidateAll(
                id,
                userContext.userId,
                campaign.categoryId,
            )

            if (campaign.coverImageFileKey) {
                await this.spacesUploadService.deleteResourceImage(
                    campaign.coverImageFileKey,
                )
            }

            return result
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaign",
                campaignId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
            })
            throw error
        }
    }

    async resolveReference(reference: { __typename: string; id: string }) {
        return this.findCampaignById(reference.id)
    }

    async getPlatformStats(
        filter?: CampaignStatsFilterInput,
    ): Promise<CampaignStatsResponse> {
        try {
            const filterKey = this.buildFilterKey(filter)

            const cached = await this.cacheService.getPlatformStats(filterKey)
            if (cached) {
                return cached
            }

            const [
                overview,
                byStatus,
                financial,
                byCategory,
                performance,
                timeRange,
            ] = await Promise.all([
                this.getOverviewStats(filter?.categoryId),
                this.getStatusBreakdown(filter?.categoryId),
                this.getFinancialStats(filter?.categoryId),
                this.getCategoryBreakdown(),
                this.getPerformanceStats(),
                filter?.dateFrom && filter?.dateTo
                    ? this.getTimeRangeStats(filter.dateFrom, filter.dateTo)
                    : Promise.resolve(undefined),
            ])

            const stats: CampaignStatsResponse = {
                overview,
                byStatus,
                financial,
                byCategory,
                performance,
                timeRange,
            }

            await this.cacheService.setPlatformStats(filterKey, stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getPlatformStats",
                filter,
            })
            throw error
        }
    }

    async getCategoryStats(categoryId: string): Promise<CampaignStatsResponse> {
        try {
            const cached = await this.cacheService.getCategoryStats(categoryId)
            if (cached) {
                return cached
            }

            const [overview, byStatus, financial, performance] =
                await Promise.all([
                    this.getOverviewStats(categoryId),
                    this.getStatusBreakdown(categoryId),
                    this.getFinancialStats(categoryId),
                    this.getPerformanceStats(),
                ])

            const stats: CampaignStatsResponse = {
                overview,
                byStatus,
                financial,
                byCategory: [],
                performance,
            }

            await this.cacheService.setCategoryStats(categoryId, stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getCategoryStats",
                categoryId,
            })
            throw error
        }
    }

    async getUserCampaignStats(
        userContext: UserContext,
    ): Promise<CampaignStatsResponse> {
        if (userContext.role !== Role.FUNDRAISER) {
            throw new Error(
                "Only fundraisers can access their campaign statistics",
            )
        }
        const cached = await this.cacheService.getUserCampaignStats(
            userContext.userId,
        )
        if (cached) {
            return cached
        }

        const [overview, byStatus, financial] = await Promise.all([
            this.getUserOverviewStats(userContext.userId),
            this.getUserStatusBreakdown(userContext.userId),
            this.getUserFinancialStats(userContext.userId),
        ])

        const stats: CampaignStatsResponse = {
            overview,
            byStatus,
            financial,
            byCategory: [],
            performance: {
                successRate: 0,
                averageDurationDays: undefined,
                mostFundedCampaign: undefined,
            },
        }

        await this.cacheService.setUserCampaignStats(userContext.userId, stats)

        return stats
    }

    private async processCoverImageUpdate(
        coverImageFileKey: string | undefined,
        campaign: Campaign,
    ): Promise<CoverImageUpdateResult> {
        if (!coverImageFileKey) {
            return {
                updateData: {},
                oldFileKeyToDelete: null,
            }
        }

        const newFileKey = this.extractAndValidateFileKey(coverImageFileKey)

        if (campaign.coverImageFileKey === newFileKey) {
            return {
                updateData: {},
                oldFileKeyToDelete: null,
            }
        }

        await this.validateUploadedFile(coverImageFileKey)

        return {
            updateData: {
                coverImage: `${this.SPACES_CDN_ENDPOINT}/${newFileKey}`,
                coverImageFileKey: newFileKey,
            },
            oldFileKeyToDelete: campaign.coverImageFileKey ?? null,
        }
    }

    private extractAndValidateFileKey(fileKey: string): string {
        const extractedKey = this.spacesUploadService.extractFileKeyFromUrl(
            this.resource,
            fileKey,
        )

        if (!extractedKey?.startsWith(`${this.resource}/`)) {
            throw new BadRequestException(
                "Invalid file key. Please use a valid file key from generateUploadUrl.",
            )
        }

        return extractedKey
    }

    private async validateUploadedFile(fileKey: string): Promise<void> {
        const fileValidation =
            await this.spacesUploadService.validateUploadedFile(fileKey)

        if (!fileValidation.exists) {
            throw new BadRequestException(
                "Cover image file not found. Please upload the file first using generateUploadUrl.",
            )
        }
    }

    private processFundraisingDatesUpdate(
        input: UpdateCampaignInput,
        campaign: Campaign,
        updateData: any,
    ): void {
        if (!input.fundraisingStartDate && !input.fundraisingEndDate) {
            return
        }

        const startDate =
            input.fundraisingStartDate ?? campaign.fundraisingStartDate
        const endDate = input.fundraisingEndDate ?? campaign.fundraisingEndDate

        this.validateCampaignDates(startDate, endDate)

        if (input.fundraisingStartDate) {
            updateData.fundraisingStartDate = input.fundraisingStartDate
        }

        if (input.fundraisingEndDate) {
            updateData.fundraisingEndDate = input.fundraisingEndDate
        }
    }

    private processBasicFieldUpdates(
        input: UpdateCampaignInput,
        updateData: any,
    ): void {
        if (input.title) {
            updateData.title = input.title
        }

        if (input.description) {
            updateData.description = input.description
        }

        if (input.targetAmount) {
            updateData.targetAmount = this.parseAndValidateTargetAmount(
                input.targetAmount,
            )
        }

        if (input.categoryId !== undefined) {
            updateData.categoryId = input.categoryId
        }
    }

    private handleStatusReversion(campaign: Campaign, updateData: any): void {
        if (campaign.status === CampaignStatus.APPROVED) {
            updateData.status = CampaignStatus.PENDING
            updateData.changedStatusAt = null
        }
    }

    private async updateCampaignCache(
        campaignId: string,
        updatedCampaign: Campaign,
        userId: string,
        oldCategoryId?: string,
        newCategoryId?: string,
    ): Promise<void> {
        await this.cacheService.setCampaign(campaignId, updatedCampaign)

        await this.cacheService.invalidateAll(
            campaignId,
            userId,
            oldCategoryId ?? newCategoryId,
        )
    }

    private async getOverviewStats(
        categoryId?: string,
    ): Promise<CampaignOverviewStats> {
        const [totalCampaigns, activeCampaigns, completedCampaigns] =
            await Promise.all([
                this.campaignRepository.getTotalCampaigns(categoryId),
                this.campaignRepository.getCountByStatus(
                    CampaignStatus.ACTIVE,
                    categoryId,
                ),
                this.campaignRepository.getCountByStatus(
                    CampaignStatus.COMPLETED,
                    categoryId,
                ),
            ])

        return {
            totalCampaigns,
            activeCampaigns,
            completedCampaigns,
        }
    }

    private async getStatusBreakdown(
        categoryId?: string,
    ): Promise<CampaignStatusBreakdown> {
        const [
            pending,
            approved,
            active,
            processing,
            completed,
            rejected,
            cancelled,
        ] = await Promise.all([
            this.campaignRepository.getCountByStatus(
                CampaignStatus.PENDING,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.APPROVED,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.ACTIVE,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.PROCESSING,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.COMPLETED,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.REJECTED,
                categoryId,
            ),
            this.campaignRepository.getCountByStatus(
                CampaignStatus.CANCELLED,
                categoryId,
            ),
        ])

        return {
            pending,
            approved,
            active,
            processing,
            completed,
            rejected,
            cancelled,
        }
    }

    private async getFinancialStats(
        categoryId?: string,
    ): Promise<CampaignFinancialStats> {
        const aggregates =
            await this.campaignRepository.getFinancialAggregates(categoryId)

        const averageDonationAmount =
            aggregates.totalDonations > 0
                ? Number(aggregates.totalReceivedAmount) /
                  aggregates.totalDonations
                : 0

        const fundingRate =
            Number(aggregates.totalTargetAmount) > 0
                ? (Number(aggregates.totalReceivedAmount) /
                      Number(aggregates.totalTargetAmount)) *
                  100
                : 0

        return {
            totalTargetAmount: aggregates.totalTargetAmount.toString(),
            totalReceivedAmount: aggregates.totalReceivedAmount.toString(),
            totalDonations: aggregates.totalDonations,
            averageDonationAmount: Math.round(averageDonationAmount).toString(),
            fundingRate: Math.round(fundingRate * 100) / 100,
        }
    }

    private async getCategoryBreakdown(): Promise<CampaignCategoryStats[]> {
        const categoryStats = await this.campaignRepository.getCategoryStats()

        return categoryStats.map((stat) => ({
            categoryId: stat.categoryId,
            categoryTitle: stat.categoryTitle,
            campaignCount: stat.campaignCount,
            totalReceivedAmount: stat.totalReceivedAmount.toString(),
        }))
    }

    private async getPerformanceStats(): Promise<CampaignPerformanceStats> {
        const [
            totalCampaigns,
            completedCampaigns,
            averageDuration,
            mostFundedCampaign,
        ] = await Promise.all([
            this.campaignRepository.getTotalCampaigns(),
            this.campaignRepository.getCountByStatus(CampaignStatus.COMPLETED),
            this.campaignRepository.getAverageCampaignDuration(),
            this.campaignRepository.getMostFundedCampaign(),
        ])

        const successRate =
            totalCampaigns > 0 ? (completedCampaigns / totalCampaigns) * 100 : 0

        return {
            successRate: Math.round(successRate * 100) / 100,
            averageDurationDays: averageDuration ?? undefined,
            mostFundedCampaign: mostFundedCampaign ?? undefined,
        }
    }

    private async getTimeRangeStats(
        dateFrom: Date,
        dateTo: Date,
    ): Promise<CampaignTimeRangeStats> {
        const stats = await this.campaignRepository.getTimeRangeStats(
            dateFrom,
            dateTo,
        )

        return {
            startDate: dateFrom,
            endDate: dateTo,
            campaignsCreated: stats.campaignsCreated,
            campaignsCompleted: stats.campaignsCompleted,
            totalRaised: stats.totalRaised.toString(),
            donationsMade: stats.donationsMade,
        }
    }

    private async getUserOverviewStats(
        userId: string,
    ): Promise<CampaignOverviewStats> {
        const filter = { created_by: userId }

        const [totalCampaigns, activeCampaigns, completedCampaigns] =
            await Promise.all([
                this.campaignRepository.count(filter),
                this.campaignRepository.count({
                    ...filter,
                    status: CampaignStatus.ACTIVE,
                }),
                this.campaignRepository.count({
                    ...filter,
                    status: CampaignStatus.COMPLETED,
                }),
            ])

        return {
            totalCampaigns,
            activeCampaigns,
            completedCampaigns,
        }
    }

    private async getUserStatusBreakdown(
        userId: string,
    ): Promise<CampaignStatusBreakdown> {
        const filter = { created_by: userId }

        const [
            pending,
            approved,
            active,
            processing,
            completed,
            rejected,
            cancelled,
        ] = await Promise.all([
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.PENDING,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.APPROVED,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.ACTIVE,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.PROCESSING,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.COMPLETED,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.REJECTED,
            }),
            this.campaignRepository.count({
                ...filter,
                status: CampaignStatus.CANCELLED,
            }),
        ])

        return {
            pending,
            approved,
            active,
            processing,
            completed,
            rejected,
            cancelled,
        }
    }

    private async getUserFinancialStats(
        userId: string,
    ): Promise<CampaignFinancialStats> {
        const campaigns = await this.campaignRepository.findMany({
            filter: { creatorId: userId },
            limit: 1000,
        })

        const totalTargetAmount = campaigns.reduce(
            (sum, c) => sum + BigInt(c.targetAmount),
            BigInt(0),
        )
        const totalReceivedAmount = campaigns.reduce(
            (sum, c) => sum + BigInt(c.receivedAmount),
            BigInt(0),
        )
        const totalDonations = campaigns.reduce(
            (sum, c) => sum + c.donationCount,
            0,
        )

        const averageDonationAmount =
            totalDonations > 0
                ? Number(totalReceivedAmount) / totalDonations
                : 0

        const fundingRate =
            Number(totalTargetAmount) > 0
                ? (Number(totalReceivedAmount) / Number(totalTargetAmount)) *
                  100
                : 0

        return {
            totalTargetAmount: totalTargetAmount.toString(),
            totalReceivedAmount: totalReceivedAmount.toString(),
            totalDonations,
            averageDonationAmount: Math.round(averageDonationAmount).toString(),
            fundingRate: Math.round(fundingRate * 100) / 100,
        }
    }

    private buildFilterKey(filter?: CampaignStatsFilterInput): string {
        if (!filter) return "all"

        const parts: string[] = []
        if (filter.categoryId) parts.push(`cat:${filter.categoryId}`)
        if (filter.creatorId) parts.push(`user:${filter.creatorId}`)
        if (filter.status) parts.push(`status:${filter.status.join(",")}`)
        if (filter.dateFrom) parts.push(`from:${filter.dateFrom.toISOString()}`)
        if (filter.dateTo) parts.push(`to:${filter.dateTo.toISOString()}`)

        return parts.length > 0 ? parts.join("|") : "all"
    }

    private validateCampaignDates(
        fundraisingStartDate: Date,
        fundraisingEndDate: Date,
    ): void {
        if (
            !(fundraisingStartDate instanceof Date) ||
            !(fundraisingEndDate instanceof Date)
        ) {
            throw new BadRequestException(
                "Start date and end date must be valid Date objects",
            )
        }

        if (
            Number.isNaN(fundraisingStartDate.getTime()) ||
            Number.isNaN(fundraisingEndDate.getTime())
        ) {
            throw new BadRequestException(
                "Start date and end date must be valid dates",
            )
        }

        const now = new Date()
        const start = new Date(fundraisingStartDate)
        const end = new Date(fundraisingEndDate)

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startDay = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
        )
        const endDay = new Date(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
        )

        if (startDay < today) {
            throw new BadRequestException(
                "Start date cannot be in the past. Please select today or a future date.",
            )
        }

        if (endDay <= startDay) {
            throw new BadRequestException(
                "End date must be after the start date. Please ensure there's at least one day between start and end dates.",
            )
        }

        const maxDurationMs = 365 * 24 * 60 * 60 * 1000
        const durationMs = end.getTime() - start.getTime()

        if (durationMs > maxDurationMs) {
            throw new BadRequestException(
                "Campaign duration cannot exceed 1 year. Please select an end date within one year of the start date.",
            )
        }

        const minDurationMs = 24 * 60 * 60 * 1000
        if (durationMs < minDurationMs) {
            throw new BadRequestException(
                "Campaign must run for at least 1 day. Please ensure there's adequate time between start and end dates.",
            )
        }
    }

    private parseAndValidateTargetAmount(targetAmount: string): bigint {
        const trimmed = targetAmount.trim()

        if (!trimmed || Number.isNaN(Number(trimmed))) {
            throw new BadRequestException(
                "Target amount must be a valid numeric string",
            )
        }

        const amount = BigInt(targetAmount)

        if (amount <= 0n) {
            throw new BadRequestException(
                "Target amount must be greater than 0",
            )
        }

        return amount
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
            [CampaignStatus.APPROVED]: [
                CampaignStatus.ACTIVE,
                CampaignStatus.CANCELLED,
            ],
            [CampaignStatus.ACTIVE]: [
                CampaignStatus.PROCESSING,
                CampaignStatus.CANCELLED,
            ],
            [CampaignStatus.PROCESSING]: [
                CampaignStatus.COMPLETED,
                CampaignStatus.CANCELLED,
            ],
            [CampaignStatus.REJECTED]: [],
            [CampaignStatus.COMPLETED]: [],
            [CampaignStatus.CANCELLED]: [],
            [CampaignStatus.ENDED]: [],
        }

        const allowedTransitions = validTransitions[currentStatus] || []

        if (!allowedTransitions.includes(newStatus)) {
            throw new BadRequestException(
                `Invalid status transition from ${currentStatus} to ${newStatus}`,
            )
        }
    }

    private validateCampaignForUpdate(campaign: Campaign): void {
        const nonEditableStatuses = [
            CampaignStatus.APPROVED,
            CampaignStatus.ACTIVE,
            CampaignStatus.REJECTED,
            CampaignStatus.COMPLETED,
            CampaignStatus.CANCELLED,
        ]

        if (nonEditableStatuses.includes(campaign.status)) {
            throw new ForbiddenException(
                `Cannot modify campaign in ${campaign.status} status`,
            )
        }
    }

    private async validateCategoryExists(categoryId: string): Promise<void> {
        try {
            const category =
                await this.campaignCategoryRepository.findById(categoryId)

            if (!category) {
                throw new BadRequestException(
                    `Campaign category with ID ${categoryId} not found`,
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            this.sentryService.captureError(error as Error, {
                operation: "validateCategoryExists",
                categoryId,
                service: "campaign-service",
            })

            throw new BadRequestException("Invalid category ID provided")
        }
    }

    async revertToPending(
        campaignId: string,
        reason: string,
    ): Promise<Campaign> {
        const campaign = await this.campaignRepository.update(campaignId, {
            status: CampaignStatus.PENDING,
            changedStatusAt: null,
        })

        await this.cacheService.deleteCampaign(campaignId)
        await this.cacheService.invalidateAll()

        return campaign
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