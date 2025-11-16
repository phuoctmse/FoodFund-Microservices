import { Injectable } from "@nestjs/common"
import { BadRequestException } from "@nestjs/common"
import { SentryService } from "@libs/observability"
import { GrpcClientService } from "@libs/grpc"

@Injectable()
export abstract class BaseOperationService {
    constructor(
        protected readonly sentryService: SentryService,
        protected readonly grpcClient: GrpcClientService,
    ) {}

    // ==================== Campaign Phase Operations ====================

    /**
     * Get all phases for a campaign via gRPC
     */
    protected async getCampaignPhases(campaignId: string): Promise<
        Array<{
            id: string
            campaignId: string
            phaseName: string
            location: string
            ingredientPurchaseDate: string
            cookingDate: string
            deliveryDate: string
        }>
    > {
        try {
            const response = await this.grpcClient.callCampaignService<
                { campaignId: string },
                {
                    success: boolean
                    phases: Array<{
                        id: string
                        campaignId: string
                        phaseName: string
                        location: string
                        ingredientPurchaseDate: string
                        cookingDate: string
                        deliveryDate: string
                    }>
                    error: string | null
                }
            >(
                "GetCampaignPhases",
                { campaignId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                throw new BadRequestException(
                    response.error || "Failed to fetch campaign phases",
                )
            }

            return response.phases || []
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: `${this.constructor.name}.getCampaignPhases`,
                campaignId,
            })
            throw error
        }
    }

    /**
     * Get single campaign phase via gRPC
     */
    protected async getCampaignPhase(phaseId: string): Promise<{
        id: string
        campaignId: string
        phaseName: string
        ingredientFundsAmount: string
        cookingFundsAmount: string
        deliveryFundsAmount: string
    }> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    phase?: {
                        id: string
                        campaignId: string
                        phaseName: string
                        ingredientFundsAmount: string
                        cookingFundsAmount: string
                        deliveryFundsAmount: string
                    }
                    error: string | null
                }
            >("GetCampaignPhase", { phaseId }, { timeout: 5000, retries: 2 })

            if (!response.success || !response.phase) {
                throw new BadRequestException(
                    response.error || `Campaign phase ${phaseId} not found`,
                )
            }

            return response.phase
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            this.sentryService.captureError(error as Error, {
                operation: `${this.constructor.name}.getCampaignPhase`,
                phaseId,
            })
            throw new BadRequestException(
                "Unable to verify campaign phase budget. Please try again.",
            )
        }
    }

    /**
     * Update campaign phase status via gRPC
     */
    protected async updateCampaignPhaseStatus(
        phaseId: string,
        status: string,
    ): Promise<void> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string; status: string },
                { success: boolean; error: string | null }
            >(
                "UpdatePhaseStatus",
                { phaseId, status },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to update campaign phase status",
                )
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: `${this.constructor.name}.updateCampaignPhaseStatus`,
                phaseId,
                status,
            })
            throw error
        }
    }

    /**
     * Verify campaign phase exists via gRPC
     */
    protected async verifyCampaignPhaseExists(phaseId: string): Promise<void> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    campaignId: string | null
                    error: string | null
                }
            >("GetCampaignIdByPhaseId", { phaseId })

            if (!response.success || !response.campaignId) {
                throw new BadRequestException(
                    response.error || `Campaign phase ${phaseId} not found`,
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Failed to verify campaign phase. Please try again.",
            )
        }
    }

    /**
     * Get campaign ID from phase ID via gRPC
     */
    protected async getCampaignIdFromPhaseId(
        phaseId: string,
    ): Promise<string | null> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    campaignId?: string
                    error?: string
                }
            >(
                "GetCampaignIdByPhaseId",
                { phaseId },
                { timeout: 3000, retries: 1 },
            )

            return response.campaignId || null
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: `${this.constructor.name}.getCampaignIdFromPhaseId`,
                phaseId,
            })
            return null
        }
    }

    // ==================== Cache Invalidation ====================

    /**
     * Invalidate campaign cache via gRPC
     */
    protected async invalidateCampaignCache(
        campaignId: string,
    ): Promise<void> {
        try {
            await this.grpcClient.callCampaignService<
                { campaignId: string },
                { success: boolean; error?: string }
            >(
                "InvalidateCampaignCache",
                { campaignId },
                { timeout: 3000, retries: 1 },
            )
        } catch (error) {
            // Log warning but don't fail the operation
            this.sentryService.addBreadcrumb(
                "Failed to invalidate campaign cache",
                "warning",
                {
                    campaignId,
                    error: error.message,
                    service: this.constructor.name,
                },
            )
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Format currency for Vietnamese locale
     */
    protected formatCurrency(amount: bigint): string {
        return Number(amount).toLocaleString("vi-VN")
    }

    /**
     * Parse and validate total cost
     */
    protected parseTotalCost(totalCost: string): bigint {
        try {
            const cost = BigInt(totalCost)

            if (cost < 0n) {
                throw new BadRequestException("Total cost cannot be negative")
            }

            if (cost === 0n) {
                throw new BadRequestException(
                    "Total cost must be greater than 0",
                )
            }

            return cost
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Invalid total cost format. Must be a valid number.",
            )
        }
    }

    /**
     * Validate budget against phase budget
     */
    protected async validateBudget(
        phaseId: string,
        requestCost: bigint,
        budgetType: "ingredientFundsAmount" | "cookingFundsAmount" | "deliveryFundsAmount",
        phaseName?: string,
    ): Promise<void> {
        const phase = await this.getCampaignPhase(phaseId)
        const budget = BigInt(phase[budgetType] || "0")

        if (budget === 0n) {
            throw new BadRequestException(
                `Campaign phase "${phase.phaseName}" has not received any donations yet. ` +
                    `Cannot create ${budgetType.replace("FundsAmount", "")} request without budget.`,
            )
        }

        if (requestCost > budget) {
            const requestFormatted = this.formatCurrency(requestCost)
            const budgetFormatted = this.formatCurrency(budget)

            throw new BadRequestException(
                `Request cost (${requestFormatted} VND) exceeds allocated ${budgetType.replace("FundsAmount", "")} budget ` +
                    `for phase "${phase.phaseName}" (${budgetFormatted} VND).`,
            )
        }
    }
}