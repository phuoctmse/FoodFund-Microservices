import {
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { SentryService } from "@libs/observability"
import { CampaignPhaseRepository } from "../../repositories/campaign-phase.repository"
import { CampaignService } from "../campaign/campaign.service"
import { CampaignCacheService } from "../campaign/campaign-cache.service"
import { CreatePhaseInput, UpdatePhaseInput } from "../../dtos/campaign-phase/request"
import { UserContext } from "@app/campaign/src/shared"
import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"

@Injectable()
export class CampaignPhaseService {
    constructor(
        private readonly phaseRepository: CampaignPhaseRepository,
        private readonly sentryService: SentryService,
        @Inject(forwardRef(() => CampaignService))
        private readonly campaignService: CampaignService,
        private readonly campaignCacheService: CampaignCacheService,
    ) {}

    async createPhase(
        campaignId: string,
        input: CreatePhaseInput,
        userContext: UserContext,
    ): Promise<CampaignPhase> {
        try {
            const campaign =
                await this.campaignService.findCampaignById(campaignId)

            if (campaign.createdBy !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only add phases to campaigns you created",
                )
            }

            if (
                campaign.status !== CampaignStatus.PENDING &&
                campaign.status !== CampaignStatus.APPROVED
            ) {
                throw new ForbiddenException(
                    `Cannot add phases to campaign in ${campaign.status} status. Only PENDING or APPROVED campaigns can be modified.`,
                )
            }

            this.validatePhaseDates([input], campaign.fundraisingEndDate)
            if (input.phaseName.length < 5) {
                throw new BadRequestException(
                    "Phase name must be at least 5 characters",
                )
            }

            const cookingToDeliveryMs =
                input.deliveryDate.getTime() - input.cookingDate.getTime()
            const maxDurationMs = 24 * 60 * 60 * 1000

            if (
                cookingToDeliveryMs > maxDurationMs ||
                cookingToDeliveryMs < 0
            ) {
                throw new BadRequestException(
                    "Delivery date must be within 24 hours from cooking date for food safety",
                )
            }

            if (input.cookingDate < input.ingredientPurchaseDate) {
                throw new BadRequestException(
                    "Cooking date must be after ingredient purchase date",
                )
            }

            if (input.deliveryDate < input.cookingDate) {
                throw new BadRequestException(
                    "Delivery date must be after cooking date",
                )
            }

            const phase = await this.phaseRepository.create({
                campaignId,
                phaseName: input.phaseName,
                location: input.location,
                ingredientPurchaseDate: input.ingredientPurchaseDate,
                cookingDate: input.cookingDate,
                deliveryDate: input.deliveryDate,
            })

            await this.campaignCacheService.deleteCampaign(campaignId)
            await this.campaignCacheService.invalidateAll(
                campaignId,
                campaign.createdBy,
                campaign.categoryId,
            )

            if (campaign.status === CampaignStatus.APPROVED) {
                await this.campaignService.revertToPending(
                    campaignId,
                    "Phase added - requires re-approval",
                )
            }
            this.sentryService.addBreadcrumb(
                "Campaign phase created",
                "campaign-phase",
                {
                    phaseId: phase.id,
                    campaignId,
                    user: {
                        id: userContext.userId,
                        username: userContext.username,
                    },
                },
            )

            return phase
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createCampaignPhase",
                campaignId,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }

    async getPhasesByCampaignId(campaignId: string): Promise<CampaignPhase[]> {
        try {
            return await this.phaseRepository.findByCampaignId(campaignId)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getPhasesByCampaignId",
                campaignId,
            })
            throw error
        }
    }

    async getPhaseById(id: string): Promise<CampaignPhase> {
        const phase = await this.phaseRepository.findById(id)
        if (!phase) {
            throw new NotFoundException(`Phase with ID ${id} not found`)
        }
        return phase
    }

    async updatePhase(
        id: string,
        input: UpdatePhaseInput,
        userContext: UserContext,
    ): Promise<CampaignPhase> {
        try {
            const phase = await this.getPhaseById(id)
            const campaign = await this.campaignService.findCampaignById(
                phase.campaignId,
            )

            if (campaign.createdBy !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only update phases of campaigns you created",
                )
            }

            if (
                campaign.status !== CampaignStatus.PENDING &&
                campaign.status !== CampaignStatus.APPROVED
            ) {
                throw new ForbiddenException(
                    `Cannot update phases of campaign in ${campaign.status} status.`,
                )
            }

            if (input.phaseName !== undefined && input.phaseName.length < 5) {
                throw new BadRequestException(
                    "Phase name must be at least 5 characters",
                )
            }

            const finalIngredientDate =
                input.ingredientPurchaseDate || phase.ingredientPurchaseDate
            const finalCookingDate = input.cookingDate || phase.cookingDate
            const finalDeliveryDate = input.deliveryDate || phase.deliveryDate

            const cookingToDeliveryMs =
                finalDeliveryDate.getTime() - finalCookingDate.getTime()
            const maxDurationMs = 24 * 60 * 60 * 1000

            if (
                cookingToDeliveryMs > maxDurationMs ||
                cookingToDeliveryMs < 0
            ) {
                throw new BadRequestException(
                    "Delivery date must be within 24 hours from cooking date for food safety",
                )
            }

            if (finalCookingDate < finalIngredientDate) {
                throw new BadRequestException(
                    "Cooking date must be after ingredient purchase date",
                )
            }

            if (finalDeliveryDate < finalCookingDate) {
                throw new BadRequestException(
                    "Delivery date must be after cooking date",
                )
            }

            if (input.ingredientPurchaseDate) {
                const endDate =
                    typeof campaign.fundraisingEndDate === "string"
                        ? new Date(campaign.fundraisingEndDate)
                        : campaign.fundraisingEndDate

                const endDateNormalized = new Date(
                    endDate.getFullYear(),
                    endDate.getMonth(),
                    endDate.getDate(),
                )

                const ingredientDateNormalized = new Date(
                    finalIngredientDate.getFullYear(),
                    finalIngredientDate.getMonth(),
                    finalIngredientDate.getDate(),
                )

                if (ingredientDateNormalized <= endDateNormalized) {
                    throw new BadRequestException(
                        `Ingredient purchase date must be after fundraising end date (${endDate.toISOString().split("T")[0]})`,
                    )
                }
            }

            const updateData: {
                phaseName?: string
                location?: string
                ingredientPurchaseDate?: Date
                cookingDate?: Date
                deliveryDate?: Date
            } = {}

            if (input.phaseName !== undefined) {
                updateData.phaseName = input.phaseName
            }
            if (input.location !== undefined) {
                updateData.location = input.location
            }
            if (input.ingredientPurchaseDate !== undefined) {
                updateData.ingredientPurchaseDate = input.ingredientPurchaseDate
            }
            if (input.cookingDate !== undefined) {
                updateData.cookingDate = input.cookingDate
            }
            if (input.deliveryDate !== undefined) {
                updateData.deliveryDate = input.deliveryDate
            }

            if (Object.keys(updateData).length === 0) {
                throw new BadRequestException(
                    "At least one field must be provided for update",
                )
            }

            const updatedPhase = await this.phaseRepository.update(
                id,
                updateData,
            )

            await this.campaignCacheService.deleteCampaign(phase.campaignId)
            await this.campaignCacheService.invalidateAll(
                phase.campaignId,
                campaign.createdBy,
                campaign.categoryId,
            )

            if (campaign.status === CampaignStatus.APPROVED) {
                await this.campaignService.revertToPending(
                    campaign.id,
                    "Phase updated - requires re-approval",
                )
            }

            this.sentryService.addBreadcrumb(
                "Campaign phase updated",
                "campaign-phase",
                {
                    phaseId: id,
                    campaignId: phase.campaignId,
                    user: {
                        id: userContext.userId,
                        username: userContext.username,
                    },
                    updatedFields: Object.keys(updateData),
                    cacheInvalidated: true,
                },
            )

            return updatedPhase
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaignPhase",
                phaseId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }

    validatePhaseDates(
        phases: CreatePhaseInput[],
        fundraisingEndDate: Date | string,
    ): void {
        const endDate =
            typeof fundraisingEndDate === "string"
                ? new Date(fundraisingEndDate)
                : fundraisingEndDate

        if (isNaN(endDate.getTime())) {
            throw new BadRequestException(
                "Invalid fundraising end date provided",
            )
        }

        const endDateNormalized = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
        )

        const sortedPhases = [...phases].sort(
            (a, b) =>
                a.ingredientPurchaseDate.getTime() -
                b.ingredientPurchaseDate.getTime(),
        )

        for (let i = 0; i < sortedPhases.length; i++) {
            const phase = sortedPhases[i]

            const ingredientDate =
                typeof phase.ingredientPurchaseDate === "string"
                    ? new Date(phase.ingredientPurchaseDate)
                    : phase.ingredientPurchaseDate
            const cookingDate =
                typeof phase.cookingDate === "string"
                    ? new Date(phase.cookingDate)
                    : phase.cookingDate
            const deliveryDate =
                typeof phase.deliveryDate === "string"
                    ? new Date(phase.deliveryDate)
                    : phase.deliveryDate

            const cookingToDeliveryMs =
                deliveryDate.getTime() - cookingDate.getTime()
            const maxDurationMs = 24 * 60 * 60 * 1000

            if (
                cookingToDeliveryMs > maxDurationMs ||
                cookingToDeliveryMs < 0
            ) {
                throw new BadRequestException(
                    `Phase "${phase.phaseName}": Delivery date must be within 24 hours from cooking date for food safety`,
                )
            }

            const ingredientDateNormalized = new Date(
                ingredientDate.getFullYear(),
                ingredientDate.getMonth(),
                ingredientDate.getDate(),
            )

            if (ingredientDateNormalized <= endDateNormalized) {
                throw new BadRequestException(
                    `Phase "${phase.phaseName}": All phase dates must be after fundraising end date (${endDate.toISOString().split("T")[0]})`,
                )
            }

            if (i > 0) {
                const prevPhase = sortedPhases[i - 1]

                const prevIngredientDate =
                    typeof prevPhase.ingredientPurchaseDate === "string"
                        ? new Date(prevPhase.ingredientPurchaseDate)
                        : prevPhase.ingredientPurchaseDate
                const prevCookingDate =
                    typeof prevPhase.cookingDate === "string"
                        ? new Date(prevPhase.cookingDate)
                        : prevPhase.cookingDate
                const prevDeliveryDate =
                    typeof prevPhase.deliveryDate === "string"
                        ? new Date(prevPhase.deliveryDate)
                        : prevPhase.deliveryDate

                const prevLatestDate = new Date(
                    Math.max(
                        prevIngredientDate.getTime(),
                        prevCookingDate.getTime(),
                        prevDeliveryDate.getTime(),
                    ),
                )

                if (ingredientDate <= prevLatestDate) {
                    throw new BadRequestException(
                        `Phase "${phase.phaseName}" overlaps with "${prevPhase.phaseName}". Please ensure phases do not overlap.`,
                    )
                }
            }

            if (cookingDate < ingredientDate) {
                throw new BadRequestException(
                    `Phase "${phase.phaseName}": Cooking date must be after ingredient purchase date`,
                )
            }

            if (deliveryDate < cookingDate) {
                throw new BadRequestException(
                    `Phase "${phase.phaseName}": Delivery date must be after cooking date`,
                )
            }
        }
    }

    async deletePhase(id: string, userContext: UserContext): Promise<boolean> {
        try {
            const phase = await this.getPhaseById(id)
            const campaign = await this.campaignService.findCampaignById(
                phase.campaignId,
            )

            if (campaign.createdBy !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only delete phases of campaigns you created",
                )
            }

            if (
                campaign.status !== CampaignStatus.PENDING &&
                campaign.status !== CampaignStatus.APPROVED
            ) {
                throw new ForbiddenException(
                    `Cannot delete phases of campaign in ${campaign.status} status. Only PENDING or APPROVED campaigns can be modified.`,
                )
            }

            const result = await this.phaseRepository.delete(id)

            if (!result) {
                throw new BadRequestException(`Failed to delete phase ${id}`)
            }

            await this.campaignCacheService.deleteCampaign(phase.campaignId)
            await this.campaignCacheService.invalidateAll(
                phase.campaignId,
                campaign.createdBy,
                campaign.categoryId,
            )

            if (campaign.status === CampaignStatus.APPROVED) {
                await this.campaignService.revertToPending(
                    campaign.id,
                    "Phase deleted - requires re-approval",
                )
            }

            this.sentryService.addBreadcrumb(
                "Campaign phase deleted",
                "campaign-phase",
                {
                    phaseId: id,
                    campaignId: phase.campaignId,
                    user: {
                        id: userContext.userId,
                        username: userContext.username,
                    },
                    cacheInvalidated: true,
                },
            )

            return true
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaignPhase",
                phaseId: id,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }

    async deleteManyPhases(
        ids: string[],
        userContext: UserContext,
    ): Promise<{ deletedCount: number; campaignIds: string[] }> {
        try {
            if (ids.length === 0) {
                throw new BadRequestException(
                    "At least one phase ID is required",
                )
            }

            const phases = await Promise.all(
                ids.map((id) => this.phaseRepository.findById(id)),
            )

            const existingPhases = phases.filter((p) => p !== null)

            if (existingPhases.length === 0) {
                throw new NotFoundException("No phases found with provided IDs")
            }

            const campaignIds = [
                ...new Set(existingPhases.map((p) => p!.campaignId)),
            ]

            const campaigns = await Promise.all(
                campaignIds.map((cid) =>
                    this.campaignService.findCampaignById(cid),
                ),
            )

            const unauthorizedCampaign = campaigns.find(
                (c) => c.createdBy !== userContext.userId,
            )

            if (unauthorizedCampaign) {
                throw new ForbiddenException(
                    "You can only delete phases of campaigns you created",
                )
            }

            const invalidStatusCampaign = campaigns.find(
                (c) =>
                    c.status !== CampaignStatus.PENDING &&
                    c.status !== CampaignStatus.APPROVED,
            )

            if (invalidStatusCampaign) {
                throw new ForbiddenException(
                    `Cannot delete phases of campaign in ${invalidStatusCampaign.status} status.`,
                )
            }

            const deletedCount = await this.phaseRepository.deleteMany(
                existingPhases.map((p) => p!.id),
            )

            await Promise.all(
                campaigns.map(async (campaign) => {
                    await this.campaignCacheService.deleteCampaign(campaign.id)
                    await this.campaignCacheService.invalidateAll(
                        campaign.id,
                        campaign.createdBy,
                        campaign.categoryId,
                    )

                    if (campaign.status === CampaignStatus.APPROVED) {
                        await this.campaignService.revertToPending(
                            campaign.id,
                            "Phases deleted - requires re-approval",
                        )
                    }
                }),
            )

            this.sentryService.addBreadcrumb(
                "Campaign phases batch deleted",
                "campaign-phase",
                {
                    phaseIds: ids,
                    deletedCount,
                    campaignIds,
                    user: {
                        id: userContext.userId,
                        username: userContext.username,
                    },
                    cacheInvalidated: true,
                },
            )

            return { deletedCount, campaignIds }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteManyPhases",
                phaseIds: ids,
                user: {
                    id: userContext.userId,
                    username: userContext.username,
                },
            })
            throw error
        }
    }
}
