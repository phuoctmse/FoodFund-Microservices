import {
    BadRequestException,
    ForbiddenException,
    Injectable,
} from "@nestjs/common"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    UpdateCampaignInput,
} from "./dtos/request/campaign.input"
import { SentryService } from "@libs/observability/sentry.service"
import { CampaignRepository } from "./campaign.repository"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignStatus } from "apps/campaign/src/campaign/enum/campaign.enum"
import {
    CampaignCannotBeDeletedException,
    CampaignNotFoundException,
} from "./exceptions/campaign.exception"
import { GenerateUploadUrlInput } from "./dtos/request/generate-upload-url.input"
import { Campaign } from "./models/campaign.model"
import { Decimal } from "@prisma/client/runtime/library"
import { AuthorizationService } from "../shared/services/authorization.service"
import { UserContext } from "../shared/types/user-context.type"
import { CampaignCategoryRepository } from "../campaign-category"

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

    async createCampaign(input: CreateCampaignInput, userContext: UserContext) {
        this.authorizationService.requireAuthentication(
            userContext,
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

        this.validateCampaignDates(
            input.fundraisingStartDate,
            input.fundraisingEndDate,
        )
        this.parseAndValidateTargetAmount(input.targetAmount)
        this.validateBudgetPercentages(
            input.ingredientBudgetPercentage,
            input.cookingBudgetPercentage,
            input.deliveryBudgetPercentage,
        )

        const fileKey = this.spacesUploadService.extractFileKeyFromUrl(
            this.resource,
            input.coverImageFileKey,
        )
        if (!fileKey || !fileKey.startsWith(`${this.resource}/`)) {
            throw new BadRequestException(
                "Invalid file key. Please use a valid file key from generateCampaignImageUploadUrl.",
            )
        }

        const cdnUrl = `${this.SPACES_CDN_ENDPOINT}/${fileKey}`

        const campaign = await this.campaignRepository.create({
            title: input.title,
            description: input.description,
            coverImage: cdnUrl,
            location: input.location,
            targetAmount: input.targetAmount,
            ingredientBudgetPercentage: new Decimal(
                input.ingredientBudgetPercentage,
            ),
            cookingBudgetPercentage: new Decimal(input.cookingBudgetPercentage),
            deliveryBudgetPercentage: new Decimal(
                input.deliveryBudgetPercentage,
            ),
            fundraisingStartDate: input.fundraisingStartDate,
            fundraisingEndDate: input.fundraisingEndDate,
            ingredientPurchaseDate: input.ingredientPurchaseDate,
            cookingDate: input.cookingDate,
            deliveryDate: input.deliveryDate,
            createdBy: userContext.userId,
            status: CampaignStatus.PENDING,
            coverImageFileKey: fileKey,
            categoryId: input.categoryId,
        })

        this.sentryService.addBreadcrumb(
            "Campaign created with extended flow",
            "campaign",
            {
                campaignId: campaign.id,
                creator: {
                    id: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
                status: CampaignStatus.PENDING,
                title: input.title,
                fileKey,
            },
        )

        return campaign
    }

    async getCampaigns(
        filter?: CampaignFilterInput,
        search?: string,
        sortBy: CampaignSortOrder = CampaignSortOrder.ACTIVE_FIRST,
        limit: number = 10,
        offset: number = 0,
    ) {
        try {
            return await this.campaignRepository.findMany({
                filter,
                search,
                sortBy,
                limit,
                offset,
            })
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

    async updateCampaign(
        id: string,
        input: UpdateCampaignInput,
        userContext: UserContext,
    ) {
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

        if (input.fundraisingStartDate || input.fundraisingEndDate) {
            const startDate =
                input.fundraisingStartDate || campaign.fundraisingStartDate
            const endDate =
                input.fundraisingEndDate || campaign.fundraisingEndDate
            this.validateCampaignDates(startDate, endDate)
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

        const updateData: any = {}

        if (input.title !== undefined) updateData.title = input.title
        if (input.description !== undefined)
            updateData.description = input.description
        if (input.location !== undefined) updateData.location = input.location

        if (input.targetAmount !== undefined) {
            try {
                updateData.targetAmount = this.parseAndValidateTargetAmount(
                    input.targetAmount,
                )
            } catch (error) {
                throw new BadRequestException(
                    "Target amount must be a valid number greater than 0",
                )
            }
        }

        if (input.ingredientBudgetPercentage) {
            updateData.ingredientBudgetPercentage = new Decimal(
                input.ingredientBudgetPercentage,
            )
        }
        if (input.cookingBudgetPercentage) {
            updateData.cookingBudgetPercentage = new Decimal(
                input.cookingBudgetPercentage,
            )
        }
        if (input.deliveryBudgetPercentage) {
            updateData.deliveryBudgetPercentage = new Decimal(
                input.deliveryBudgetPercentage,
            )
        }

        if (input.fundraisingStartDate !== undefined)
            updateData.fundraisingStartDate = input.fundraisingStartDate
        if (input.fundraisingEndDate !== undefined)
            updateData.fundraisingEndDate = input.fundraisingEndDate
        if (input.ingredientPurchaseDate !== undefined)
            updateData.ingredientPurchaseDate = input.ingredientPurchaseDate
        if (input.cookingDate !== undefined)
            updateData.cookingDate = input.cookingDate
        if (input.deliveryDate !== undefined)
            updateData.deliveryDate = input.deliveryDate

        let oldFileKeyToDelete: string | null = null

        if (input.coverImageFileKey) {
            const newFileKey = this.spacesUploadService.extractFileKeyFromUrl(
                this.resource,
                input.coverImageFileKey,
            )

            if (!newFileKey || !newFileKey.startsWith(`${this.resource}/`)) {
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

        const updatedCampaign = await this.campaignRepository.update(
            id,
            updateData,
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
        })

        return updatedCampaign
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
            const updateData: any = { status: newStatus }

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
                    updateData.approvedAt = new Date()

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
                    updateData.approvedAt = new Date()
                }
            } else if (newStatus === CampaignStatus.APPROVED) {
                updateData.approvedAt = new Date()
            } else if (newStatus === CampaignStatus.COMPLETED) {
                updateData.completedAt = new Date()
            }

            const updatedCampaign = await this.campaignRepository.update(
                id,
                updateData,
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

    async findCampaignById(id: string) {
        const campaign = await this.campaignRepository.findById(id)
        if (campaign == null) {
            throw new CampaignNotFoundException(id)
        }
        return campaign
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
                CampaignStatus.REJECTED,
            ]

            if (!deletableStatuses.includes(campaign.status)) {
                throw new CampaignCannotBeDeletedException(campaign.status)
            }

            const result = await this.campaignRepository.delete(id)

            if (!result) {
                throw new BadRequestException(`Failed to delete campaign ${id}`)
            }

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

    private parseAndValidateTargetAmount(targetAmountStr: string): number {
        const trimmed = targetAmountStr.trim()

        if (!trimmed || isNaN(Number(trimmed))) {
            throw new BadRequestException(
                "Target amount must be a valid numeric string",
            )
        }

        const amount = Number(trimmed)

        if (amount <= 0) {
            throw new BadRequestException(
                "Target amount must be greater than 0",
            )
        }

        if (amount > Number.MAX_SAFE_INTEGER) {
            throw new BadRequestException(
                `Target amount cannot exceed ${Number.MAX_SAFE_INTEGER}`,
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
                CampaignStatus.AWAITING_DISBURSEMENT,
                CampaignStatus.CANCELLED,
            ],
            [CampaignStatus.AWAITING_DISBURSEMENT]: [
                CampaignStatus.FUNDS_DISBURSED,
            ],
            [CampaignStatus.FUNDS_DISBURSED]: [
                CampaignStatus.INGREDIENT_PURCHASE,
            ],
            [CampaignStatus.INGREDIENT_PURCHASE]: [CampaignStatus.COOKING],
            [CampaignStatus.COOKING]: [CampaignStatus.DELIVERY],
            [CampaignStatus.DELIVERY]: [CampaignStatus.COMPLETED],
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
            CampaignStatus.AWAITING_DISBURSEMENT,
            CampaignStatus.FUNDS_DISBURSED,
            CampaignStatus.INGREDIENT_PURCHASE,
            CampaignStatus.COOKING,
            CampaignStatus.DELIVERY,
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
