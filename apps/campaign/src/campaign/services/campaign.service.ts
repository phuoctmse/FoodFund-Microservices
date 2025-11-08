import {
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
} from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignCategoryRepository } from "../../campaign-category"
import { CampaignRepository } from "../repository"
import { CampaignCacheService } from "./campaign-cache.service"
import { CampaignStatus } from "../enum"
import { AuthorizationService, Role, UserContext } from "../../shared"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    ExtendCampaignInput,
    GenerateUploadUrlInput,
    UpdateCampaignInput,
} from "../dtos"
import {
    CampaignCannotBeDeletedException,
    CampaignNotFoundException,
} from "../exceptions"
import { Campaign } from "../models"
import { CampaignPhaseService } from "../../campaign-phase/services"

@Injectable()
export class CampaignService {
    private readonly SPACES_CDN_ENDPOINT = process.env.SPACES_CDN_ENDPOINT
    private readonly resource = "campaigns"

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly campaignCategoryRepository: CampaignCategoryRepository,
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
            if (!fileKey || !fileKey.startsWith(`${this.resource}/`)) {
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
            this.validateBudgetPercentages(
                input.ingredientBudgetPercentage,
                input.cookingBudgetPercentage,
                input.deliveryBudgetPercentage,
            )

            if (!input.phases || input.phases.length === 0) {
                throw new BadRequestException(
                    "At least one campaign phase is required",
                )
            }

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
                ingredientBudgetPercentage: parseFloat(
                    input.ingredientBudgetPercentage,
                ),
                cookingBudgetPercentage: parseFloat(
                    input.cookingBudgetPercentage,
                ),
                deliveryBudgetPercentage: parseFloat(
                    input.deliveryBudgetPercentage,
                ),
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
                })),
            })

            await this.cacheService.setCampaign(campaign.id, campaign)

            await this.cacheService.invalidateAll(
                campaign.id,
                userContext.userId,
                input.categoryId,
            )

            this.sentryService.addBreadcrumb("Campaign created", "campaign", {
                campaignId: campaign.id,
                title: campaign.title,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
                phaseCount: input.phases.length,
            })

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

    async updateCampaign(
        id: string,
        input: UpdateCampaignInput,
        userContext: UserContext,
    ) {
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
            let oldFileKeyToDelete: string | null = null

            if (input.coverImageFileKey) {
                const newFileKey =
                    this.spacesUploadService.extractFileKeyFromUrl(
                        this.resource,
                        input.coverImageFileKey,
                    )

                if (
                    !newFileKey ||
                    !newFileKey.startsWith(`${this.resource}/`)
                ) {
                    throw new BadRequestException(
                        "Invalid file key. Please use a valid file key from generateUploadUrl.",
                    )
                }

                if (campaign.coverImageFileKey !== newFileKey) {
                    const fileValidation =
                        await this.spacesUploadService.validateUploadedFile(
                            input.coverImageFileKey,
                        )

                    if (!fileValidation.exists) {
                        throw new BadRequestException(
                            "Cover image file not found. Please upload the file first using generateUploadUrl.",
                        )
                    }

                    if (campaign.coverImageFileKey) {
                        oldFileKeyToDelete = campaign.coverImageFileKey
                    }

                    updateData.coverImage = `${this.SPACES_CDN_ENDPOINT}/${newFileKey}`
                    updateData.coverImageFileKey = newFileKey
                }
            }
            if (input.fundraisingStartDate || input.fundraisingEndDate) {
                const startDate =
                    input.fundraisingStartDate || campaign.fundraisingStartDate
                const endDate =
                    input.fundraisingEndDate || campaign.fundraisingEndDate
                this.validateCampaignDates(startDate, endDate)
            }
            let targetAmountBigInt: bigint | undefined
            if (input.targetAmount) {
                targetAmountBigInt = this.parseAndValidateTargetAmount(
                    input.targetAmount,
                )
            }

            if (
                input.ingredientBudgetPercentage ||
                input.cookingBudgetPercentage ||
                input.deliveryBudgetPercentage
            ) {
                this.validateBudgetPercentages(
                    input.ingredientBudgetPercentage ||
                        campaign.ingredientBudgetPercentage,
                    input.cookingBudgetPercentage ||
                        campaign.cookingBudgetPercentage,
                    input.deliveryBudgetPercentage ||
                        campaign.deliveryBudgetPercentage,
                )
            }
            if (input.title) updateData.title = input.title
            if (input.description) updateData.description = input.description
            if (targetAmountBigInt !== undefined)
                updateData.targetAmount = targetAmountBigInt
            if (input.ingredientBudgetPercentage)
                updateData.ingredientBudgetPercentage = parseFloat(
                    input.ingredientBudgetPercentage,
                )
            if (input.cookingBudgetPercentage)
                updateData.cookingBudgetPercentage = parseFloat(
                    input.cookingBudgetPercentage,
                )
            if (input.deliveryBudgetPercentage)
                updateData.deliveryBudgetPercentage = parseFloat(
                    input.deliveryBudgetPercentage,
                )
            if (input.fundraisingStartDate)
                updateData.fundraisingStartDate = input.fundraisingStartDate
            if (input.fundraisingEndDate)
                updateData.fundraisingEndDate = input.fundraisingEndDate
            if (input.categoryId !== undefined)
                updateData.categoryId = input.categoryId
            if (campaign.status === CampaignStatus.APPROVED) {
                updateData.status = CampaignStatus.PENDING
                updateData.changedStatusAt = null
            }
            const updatedCampaign = await this.campaignRepository.update(
                id,
                updateData,
            )
            await this.cacheService.setCampaign(id, updatedCampaign)

            await this.cacheService.invalidateAll(
                id,
                userContext.userId,
                campaign.categoryId || input.categoryId,
            )
            if (oldFileKeyToDelete) {
                await this.spacesUploadService.deleteResourceImage(
                    oldFileKeyToDelete,
                )
            }
            this.sentryService.addBreadcrumb("Campaign updated", "campaign", {
                campaignId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
                updatedFields: Object.keys(input),
                coverImageReplaced: !!oldFileKeyToDelete,
                cacheInvalidated: true,
            })
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

            let finalStatus = newStatus
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
                    finalStatus = CampaignStatus.ACTIVE
                    updateData.status = CampaignStatus.ACTIVE
                    updateData.changedStatusAt = new Date()

                    this.sentryService.addBreadcrumb(
                        "Campaign auto-activated on approval",
                        "campaign",
                        {
                            campaignId: id,
                            admin: {
                                id: userContext.userId,
                                username: userContext.username,
                                role: userContext.role,
                            },
                            originalStatus: campaign.status,
                            requestedStatus: newStatus,
                            finalStatus: finalStatus,
                            startDate:
                                campaign.fundraisingStartDate.toISOString(),
                            reason: "start_date_is_today",
                        },
                    )
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

            this.sentryService.addBreadcrumb(
                "Campaign status changed",
                "campaign",
                {
                    campaignId: id,
                    admin: {
                        id: userContext.userId,
                        username: userContext.username,
                        role: userContext.role,
                    },
                    oldStatus: campaign.status,
                    newStatus: finalStatus,
                    autoActivated: finalStatus !== newStatus,
                    cacheInvalidated: true,
                },
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

            const updatedCampaign = await this.campaignRepository.update(id, {
                fundraisingEndDate: newEndDate,
                extensionCount: 1,
                extensionDays: input.extensionDays,
            })

            await this.cacheService.deleteCampaign(id)
            await this.cacheService.invalidateAll(
                id,
                userContext.userId,
                campaign.categoryId,
            )

            this.sentryService.addBreadcrumb("Campaign extended", "campaign", {
                campaignId: id,
                extensionDays: input.extensionDays,
                oldEndDate: campaign.fundraisingEndDate,
                newEndDate: newEndDate,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })

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
                try {
                    await this.spacesUploadService.deleteResourceImage(
                        campaign.coverImageFileKey,
                    )
                    this.sentryService.addBreadcrumb(
                        "Campaign cover image deleted",
                        "file-cleanup",
                        {
                            campaignId: id,
                            fileKey: campaign.coverImageFileKey,
                        },
                    )
                } catch (cleanupError) {
                    this.sentryService.captureError(cleanupError as Error, {
                        operation: "deleteCampaignCoverImage",
                        campaignId: id,
                        fileKey: campaign.coverImageFileKey,
                        note: "Campaign deleted but file cleanup failed",
                    })
                }
            }

            this.sentryService.addBreadcrumb("Campaign deleted", "campaign", {
                campaignId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
                campaignTitle: campaign.title,
                campaignStatus: campaign.status,
                hadCoverImage: !!campaign.coverImageFileKey,
                reason:
                    campaign.status === CampaignStatus.PENDING
                        ? "deleted_before_approval"
                        : "deleted_after_rejection",
                cacheInvalidated: true,
            })

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
            isNaN(fundraisingStartDate.getTime()) ||
            isNaN(fundraisingEndDate.getTime())
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

        if (!trimmed || isNaN(Number(trimmed))) {
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

    private validateBudgetPercentages(
        ingredient: string,
        cooking: string,
        delivery: string,
    ): void {
        try {
            const ingredientPct = parseFloat(ingredient)
            const cookingPct = parseFloat(cooking)
            const deliveryPct = parseFloat(delivery)

            if (
                isNaN(ingredientPct) ||
                isNaN(cookingPct) ||
                isNaN(deliveryPct)
            ) {
                throw new BadRequestException(
                    "Budget percentages must be valid numbers",
                )
            }

            if (
                ingredientPct < 0 ||
                cookingPct < 0 ||
                deliveryPct < 0 ||
                ingredientPct > 100 ||
                cookingPct > 100 ||
                deliveryPct > 100
            ) {
                throw new BadRequestException(
                    "Budget percentages must be between 0 and 100",
                )
            }

            const total = ingredientPct + cookingPct + deliveryPct
            if (Math.abs(total - 100) > 0.01) {
                throw new BadRequestException(
                    `Budget percentages must sum to 100%. Current total: ${total.toFixed(2)}%`,
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Invalid budget percentage format. Please provide valid numeric strings.",
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

        this.sentryService.addBreadcrumb(
            "Campaign reverted to PENDING",
            "campaign",
            {
                campaignId,
                reason,
            },
        )

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
