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
import { SyncPhaseInput } from "../../dtos/campaign-phase/request"
import { UserContext } from "@app/campaign/src/shared"
import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { SyncPhasesResponse } from "../../dtos/campaign-phase/response"

@Injectable()
export class CampaignPhaseService {
    constructor(
        private readonly phaseRepository: CampaignPhaseRepository,
        private readonly sentryService: SentryService,
        @Inject(forwardRef(() => CampaignService))
        private readonly campaignService: CampaignService,
        private readonly campaignCacheService: CampaignCacheService,
    ) {}

    async syncCampaignPhases(
        campaignId: string,
        phases: SyncPhaseInput[],
        userContext: UserContext,
    ): Promise<SyncPhasesResponse> {
        try {
            const campaign =
                await this.campaignService.findCampaignById(campaignId)

            if (campaign.createdBy !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only modify phases of campaigns you created",
                )
            }

            if (
                campaign.status !== CampaignStatus.PENDING &&
                campaign.status !== CampaignStatus.APPROVED
            ) {
                throw new ForbiddenException(
                    `Cannot modify phases of campaign in ${campaign.status} status. Only PENDING or APPROVED campaigns can be modified.`,
                )
            }

            if (phases.length === 0) {
                throw new BadRequestException(
                    "At least one phase is required for a campaign",
                )
            }

            this.validateTotalBudget(phases)

            this.validatePhaseDates(phases, campaign.fundraisingEndDate)

            phases.forEach((phase) => {
                if (phase.phaseName.length < 5) {
                    throw new BadRequestException(
                        `Phase "${phase.phaseName}": Phase name must be at least 5 characters`,
                    )
                }

                const cookingToDeliveryMs =
                    phase.deliveryDate.getTime() - phase.cookingDate.getTime()
                const maxDurationMs = 24 * 60 * 60 * 1000

                if (
                    cookingToDeliveryMs > maxDurationMs ||
                    cookingToDeliveryMs < 0
                ) {
                    throw new BadRequestException(
                        `Phase "${phase.phaseName}": Delivery date must be within 24 hours from cooking date for food safety`,
                    )
                }

                if (phase.cookingDate < phase.ingredientPurchaseDate) {
                    throw new BadRequestException(
                        `Phase "${phase.phaseName}": Cooking date must be after ingredient purchase date`,
                    )
                }

                if (phase.deliveryDate < phase.cookingDate) {
                    throw new BadRequestException(
                        `Phase "${phase.phaseName}": Delivery date must be after cooking date`,
                    )
                }
            })

            const result = await this.phaseRepository.syncPhases({
                campaignId,
                phases: phases.map((p) => ({
                    id: p.id,
                    phaseName: p.phaseName,
                    location: p.location,
                    ingredientPurchaseDate: p.ingredientPurchaseDate,
                    cookingDate: p.cookingDate,
                    deliveryDate: p.deliveryDate,
                    ingredientBudgetPercentage: parseFloat(
                        p.ingredientBudgetPercentage,
                    ),
                    cookingBudgetPercentage: parseFloat(
                        p.cookingBudgetPercentage,
                    ),
                    deliveryBudgetPercentage: parseFloat(
                        p.deliveryBudgetPercentage,
                    ),
                })),
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
                    "Phases modified - requires re-approval",
                )
            }

            const mappedPhases = result.phases.map((p) =>
                this.phaseRepository["mapToGraphQLModel"](p),
            )

            return {
                success: true,
                phases: mappedPhases,
                createdCount: result.createdCount,
                updatedCount: result.updatedCount,
                deletedCount: result.deletedCount,
                message: `Successfully synced ${phases.length} phases (${result.createdCount} created, ${result.updatedCount} updated, ${result.deletedCount} deleted)`,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "syncCampaignPhases",
                campaignId,
                phaseCount: phases.length,
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
        const phase = await this.phaseRepository.findByIdWithCampaign(id)
        if (!phase) {
            throw new NotFoundException(`Phase with ID ${id} not found`)
        }
        return phase
    }

    private validateTotalBudget(
        phases: Array<{
            phaseName: string
            ingredientBudgetPercentage: string
            cookingBudgetPercentage: string
            deliveryBudgetPercentage: string
        }>,
    ): void {
        let totalIngredient = 0
        let totalCooking = 0
        let totalDelivery = 0

        phases.forEach((phase, index) => {
            const ingredientPct = parseFloat(phase.ingredientBudgetPercentage)
            const cookingPct = parseFloat(phase.cookingBudgetPercentage)
            const deliveryPct = parseFloat(phase.deliveryBudgetPercentage)

            if (
                isNaN(ingredientPct) ||
                isNaN(cookingPct) ||
                isNaN(deliveryPct)
            ) {
                throw new BadRequestException(
                    `Phase ${index + 1} (${phase.phaseName}): Budget percentages must be valid numbers`,
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
                    `Phase ${index + 1} (${phase.phaseName}): Budget percentages must be between 0 and 100`,
                )
            }

            totalIngredient += ingredientPct
            totalCooking += cookingPct
            totalDelivery += deliveryPct
        })

        const grandTotal = totalIngredient + totalCooking + totalDelivery

        if (Math.abs(grandTotal - 100) > 0.01) {
            throw new BadRequestException(
                "Tổng budget của tất cả phases phải bằng 100%. " +
                    `Hiện tại: Ingredient (${totalIngredient.toFixed(2)}%) + ` +
                    `Cooking (${totalCooking.toFixed(2)}%) + ` +
                    `Delivery (${totalDelivery.toFixed(2)}%) = ${grandTotal.toFixed(2)}%`,
            )
        }

        this.sentryService.addBreadcrumb(
            "Phase budgets validated",
            "validation",
            {
                phaseCount: phases.length,
                totalIngredient,
                totalCooking,
                totalDelivery,
                grandTotal,
            },
        )
    }

    public validatePhaseDates(
        phases: Array<{
            phaseName: string
            ingredientPurchaseDate: Date
            cookingDate: Date
            deliveryDate: Date
        }>,
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
}
