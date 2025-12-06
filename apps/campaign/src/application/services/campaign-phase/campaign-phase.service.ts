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
import { PhaseBudgetValidator, UserContext } from "@app/campaign/src/shared"
import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { SyncPhasesResponse } from "../../dtos/campaign-phase/response"

interface PhaseDate {
    phaseName: string
    ingredientPurchaseDate: Date
    cookingDate: Date
    deliveryDate: Date
}

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

            PhaseBudgetValidator.validate(phases)

            this.validatePhaseDates(phases, campaign.fundraisingEndDate)

            for (const phase of phases) {
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
            }

            const result = await this.phaseRepository.syncPhases({
                campaignId,
                phases: phases.map((p) => ({
                    id: p.id,
                    phaseName: p.phaseName,
                    location: p.location,
                    ingredientPurchaseDate: p.ingredientPurchaseDate,
                    cookingDate: p.cookingDate,
                    deliveryDate: p.deliveryDate,
                    ingredientBudgetPercentage: Number.parseFloat(
                        p.ingredientBudgetPercentage,
                    ),
                    cookingBudgetPercentage: Number.parseFloat(
                        p.cookingBudgetPercentage,
                    ),
                    deliveryBudgetPercentage: Number.parseFloat(
                        p.deliveryBudgetPercentage,
                    ),
                })),
            })

            await this.campaignCacheService.deleteCampaign(campaignId)
            await this.campaignCacheService.invalidateAll(
                campaignId
            )

            if (campaign.status === CampaignStatus.APPROVED) {
                await this.campaignService.revertToPending(campaignId)
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

    public validatePhaseDates(
        phases: PhaseDate[],
        fundraisingEndDate: Date | string,
    ): void {
        const endDate = this.parseFundraisingEndDate(fundraisingEndDate)
        const sortedPhases = this.sortPhasesByIngredientDate(phases)

        for (let i = 0; i < sortedPhases.length; i++) {
            const phase = sortedPhases[i]
            const normalizedPhase = this.normalizePhaseDate(phase)

            this.validateDeliveryWithin24Hours(normalizedPhase)
            this.validateIngredientAfterFundraisingEnd(normalizedPhase, endDate)
            this.validatePhaseDateOrder(normalizedPhase)

            if (i > 0) {
                const prevPhase = this.normalizePhaseDate(sortedPhases[i - 1])
                this.validateNoPhaseOverlap(normalizedPhase, prevPhase)
            }
        }
    }

    private parseFundraisingEndDate(fundraisingEndDate: Date | string): Date {
        const endDate =
            typeof fundraisingEndDate === "string"
                ? new Date(fundraisingEndDate)
                : fundraisingEndDate

        if (Number.isNaN(endDate.getTime())) {
            throw new BadRequestException(
                "Invalid fundraising end date provided",
            )
        }

        return endDate
    }

    private sortPhasesByIngredientDate(phases: PhaseDate[]): PhaseDate[] {
        return [...phases].sort(
            (a, b) =>
                a.ingredientPurchaseDate.getTime() -
                b.ingredientPurchaseDate.getTime(),
        )
    }

    private normalizePhaseDate(phase: PhaseDate): {
        phaseName: string
        ingredientDate: Date
        cookingDate: Date
        deliveryDate: Date
    } {
        return {
            phaseName: phase.phaseName,
            ingredientDate: this.toDate(phase.ingredientPurchaseDate),
            cookingDate: this.toDate(phase.cookingDate),
            deliveryDate: this.toDate(phase.deliveryDate),
        }
    }

    private toDate(value: Date | string): Date {
        return typeof value === "string" ? new Date(value) : value
    }

    private validateDeliveryWithin24Hours(phase: {
        phaseName: string
        cookingDate: Date
        deliveryDate: Date
    }): void {
        const cookingToDeliveryMs =
            phase.deliveryDate.getTime() - phase.cookingDate.getTime()
        const maxDurationMs = 24 * 60 * 60 * 1000

        if (cookingToDeliveryMs <= 0 || cookingToDeliveryMs > maxDurationMs) {
            throw new BadRequestException(
                `Phase "${phase.phaseName}": Delivery date must be within 24 hours from cooking date for food safety`,
            )
        }
    }

    private validateIngredientAfterFundraisingEnd(
        phase: {
            phaseName: string
            ingredientDate: Date
        },
        fundraisingEndDate: Date,
    ): void {
        if (phase.ingredientDate.getTime() <= fundraisingEndDate.getTime()) {
            throw new BadRequestException(
                `Phase "${phase.phaseName}": Ingredient purchase date (${this.formatDateTime(phase.ingredientDate)}) ` +
                    `must be after fundraising end date (${this.formatDateTime(fundraisingEndDate)})`,
            )
        }
    }

    private validatePhaseDateOrder(phase: {
        phaseName: string
        ingredientDate: Date
        cookingDate: Date
        deliveryDate: Date
    }): void {
        if (phase.cookingDate.getTime() < phase.ingredientDate.getTime()) {
            throw new BadRequestException(
                `Phase "${phase.phaseName}": Cooking date must be after ingredient purchase date`,
            )
        }

        if (phase.deliveryDate.getTime() < phase.cookingDate.getTime()) {
            throw new BadRequestException(
                `Phase "${phase.phaseName}": Delivery date must be after cooking date`,
            )
        }
    }

    private validateNoPhaseOverlap(
        currentPhase: {
            phaseName: string
            ingredientDate: Date
        },
        previousPhase: {
            phaseName: string
            ingredientDate: Date
            cookingDate: Date
            deliveryDate: Date
        },
    ): void {
        const prevLatestTimestamp = this.getLatestTimestamp(previousPhase)

        if (currentPhase.ingredientDate.getTime() <= prevLatestTimestamp) {
            throw new BadRequestException(
                `Phase "${currentPhase.phaseName}" overlaps with "${previousPhase.phaseName}". ` +
                    "Please ensure phases do not overlap.",
            )
        }
    }

    private getLatestTimestamp(phase: {
        ingredientDate: Date
        cookingDate: Date
        deliveryDate: Date
    }): number {
        return Math.max(
            phase.ingredientDate.getTime(),
            phase.cookingDate.getTime(),
            phase.deliveryDate.getTime(),
        )
    }

    private formatDateTime(date: Date): string {
        return date.toISOString().replace("T", " ").substring(0, 19)
    }
}