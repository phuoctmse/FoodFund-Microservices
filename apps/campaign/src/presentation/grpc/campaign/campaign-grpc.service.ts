import { CampaignPhaseRepository } from "@app/campaign/src/application/repositories/campaign-phase.repository"
import { CampaignCacheService } from "@app/campaign/src/application/services/campaign/campaign-cache.service"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"
import { CampaignPhaseStatus } from "@app/campaign/src/domain/enums/campaign-phase/campaign-phase.enum"
import { Controller } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"

interface GetCampaignRequest {
    id: string
}

interface GetCampaignResponse {
    success: boolean
    campaign?: {
        id: string
        title: string
        description: string
        coverImage: string
        targetAmount: string
        receivedAmount: string
        donationCount: number
        status: string
        fundraisingStartDate: string
        fundraisingEndDate: string
        createdBy: string
        createdAt: string
        updatedAt: string
    }
    error?: string
}

interface GetCampaignIdByPhaseIdRequest {
    phaseId: string
}

interface GetCampaignIdByPhaseIdResponse {
    success: boolean
    campaignId: string | null
    error: string | null
}

interface GetFundraiserByPhaseIdRequest {
    phaseId: string
}

interface GetFundraiserByPhaseIdResponse {
    success: boolean
    fundraiserId: string | null
    error: string | null
}

interface GetCampaignPhasesRequest {
    campaignId: string
}

interface GetCampaignPhasesResponse {
    success: boolean
    phases: Array<{
        id: string
        campaignId: string
        phaseName: string
        location: string
        ingredientPurchaseDate: string
        cookingDate: string
        deliveryDate: string
        ingredientBudgetPercentage: string
        cookingBudgetPercentage: string
        deliveryBudgetPercentage: string
    }>
    error: string | null
}

interface GetCampaignPhaseRequest {
    phaseId: string
}

interface GetCampaignPhaseResponse {
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

interface UpdatePhaseStatusRequest {
    phaseId: string
    status: string
}

interface UpdatePhaseStatusResponse {
    success: boolean
    error: string | null
}

interface InvalidateCampaignCacheRequest {
    campaignId: string
}

interface InvalidateCampaignCacheResponse {
    success: boolean
    error: string | null
}

interface UpdateCampaignReceivedAmountRequest {
    campaignId: string
    amount: string
}

interface UpdateCampaignReceivedAmountResponse {
    success: boolean
    error: string | null
}

interface HealthRequest { }

interface HealthResponse {
    healthy: boolean
    message: string
}

@Controller()
export class CampaignGrpcService {
    constructor(
        private readonly campaignService: CampaignService,
        private readonly campaignPhaseRepository: CampaignPhaseRepository,
        private readonly campaignCacheService: CampaignCacheService,
    ) { }

    @GrpcMethod("CampaignService", "Health")
    async health(data: HealthRequest): Promise<HealthResponse> {
        return {
            healthy: true,
            message: "Campaign service is healthy",
        }
    }

    @GrpcMethod("CampaignService", "GetCampaign")
    async getCampaign(data: GetCampaignRequest): Promise<GetCampaignResponse> {
        const { id } = data

        if (!id) {
            return {
                success: false,
                error: "Campaign ID is required",
            }
        }

        const campaign = await this.campaignService.findCampaignById(id)

        if (!campaign) {
            return {
                success: false,
                error: "Campaign not found",
            }
        }

        const toISOString = (date: Date | string): string => {
            if (typeof date === "string") {
                return new Date(date).toISOString()
            }
            return date.toISOString()
        }

        return {
            success: true,
            campaign: {
                id: campaign.id,
                title: campaign.title,
                description: campaign.description || "",
                coverImage: campaign.coverImage || "",
                targetAmount: campaign.targetAmount.toString(),
                receivedAmount: campaign.receivedAmount?.toString() || "0",
                donationCount: campaign.donationCount || 0,
                status: campaign.status,
                fundraisingStartDate: toISOString(
                    campaign.fundraisingStartDate,
                ),
                fundraisingEndDate: toISOString(campaign.fundraisingEndDate),
                createdBy: campaign.createdBy,
                createdAt: toISOString(campaign.created_at),
                updatedAt: toISOString(campaign.updated_at),
            },
        }
    }

    @GrpcMethod("CampaignService", "GetCampaignIdByPhaseId")
    async getCampaignIdByPhaseId(
        data: GetCampaignIdByPhaseIdRequest,
    ): Promise<GetCampaignIdByPhaseIdResponse> {
        const { phaseId } = data

        if (!phaseId) {
            return {
                success: false,
                campaignId: null,
                error: "Phase ID is required",
            }
        }

        const campaignId =
            await this.campaignPhaseRepository.getCampaignIdByPhaseId(phaseId)

        if (!campaignId) {
            return {
                success: false,
                campaignId: null,
                error: "Campaign phase not found",
            }
        }

        return {
            success: true,
            campaignId: campaignId,
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "GetFundraiserByPhaseId")
    async getFundraiserByPhaseId(
        data: GetFundraiserByPhaseIdRequest,
    ): Promise<GetFundraiserByPhaseIdResponse> {
        const { phaseId } = data

        if (!phaseId) {
            return {
                success: false,
                fundraiserId: null,
                error: "Phase ID is required",
            }
        }

        // Get campaign ID from phase
        const campaignId =
            await this.campaignService.getCampaignIdByPhaseId(phaseId)

        if (!campaignId) {
            return {
                success: false,
                fundraiserId: null,
                error: `Campaign phase ${phaseId} not found`,
            }
        }

        // Get campaign to extract fundraiser ID
        const campaign = await this.campaignService.findCampaignById(campaignId)

        if (!campaign) {
            return {
                success: false,
                fundraiserId: null,
                error: `Campaign ${campaignId} not found`,
            }
        }

        if (!campaign.createdBy) {
            return {
                success: false,
                fundraiserId: null,
                error: `Campaign ${campaignId} has no fundraiser`,
            }
        }

        return {
            success: true,
            fundraiserId: campaign.createdBy,
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "GetCampaignPhases")
    async getCampaignPhases(
        data: GetCampaignPhasesRequest,
    ): Promise<GetCampaignPhasesResponse> {
        const { campaignId } = data

        if (!campaignId) {
            return {
                success: false,
                phases: [],
                error: "Campaign ID is required",
            }
        }

        const phases =
            await this.campaignPhaseRepository.findByCampaignId(campaignId)

        if (!phases || phases.length === 0) {
            return {
                success: true,
                phases: [],
                error: null,
            }
        }

        return {
            success: true,
            phases: phases.map((phase) => ({
                id: phase.id,
                campaignId: phase.campaignId,
                phaseName: phase.phaseName,
                location: phase.location,
                ingredientPurchaseDate:
                    phase.ingredientPurchaseDate.toISOString(),
                cookingDate: phase.cookingDate.toISOString(),
                deliveryDate: phase.deliveryDate.toISOString(),
                ingredientBudgetPercentage: phase.ingredientBudgetPercentage,
                cookingBudgetPercentage: phase.cookingBudgetPercentage,
                deliveryBudgetPercentage: phase.deliveryBudgetPercentage,
            })),
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "GetCampaignPhase")
    async getCampaignPhase(
        data: GetCampaignPhaseRequest,
    ): Promise<GetCampaignPhaseResponse> {
        const { phaseId } = data

        if (!phaseId) {
            return {
                success: false,
                phase: undefined,
                error: "Phase ID is required",
            }
        }

        const phase =
            await this.campaignPhaseRepository.findByIdWithCampaign(phaseId)

        if (!phase) {
            return {
                success: false,
                phase: undefined,
                error: `Campaign phase ${phaseId} not found`,
            }
        }

        return {
            success: true,
            phase: {
                id: phase.id,
                campaignId: phase.campaignId,
                phaseName: phase.phaseName,
                ingredientFundsAmount: phase.ingredientFundsAmount || "0",
                cookingFundsAmount: phase.cookingFundsAmount || "0",
                deliveryFundsAmount: phase.deliveryFundsAmount || "0",
            },
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "UpdatePhaseStatus")
    async updatePhaseStatus(
        data: UpdatePhaseStatusRequest,
    ): Promise<UpdatePhaseStatusResponse> {
        const { phaseId, status } = data

        if (!phaseId || !status) {
            return {
                success: false,
                error: "Phase ID and status are required",
            }
        }
        const validStatuses = Object.values(CampaignPhaseStatus)
        if (!validStatuses.includes(status as CampaignPhaseStatus)) {
            return {
                success: false,
                error: `Invalid status: ${status}. Valid statuses: ${validStatuses.join(", ")}`,
            }
        }

        await this.campaignPhaseRepository.updateStatus(
            phaseId,
            status as CampaignPhaseStatus,
        )

        return {
            success: true,
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "InvalidateCampaignCache")
    async invalidateCampaignCache(
        data: InvalidateCampaignCacheRequest,
    ): Promise<InvalidateCampaignCacheResponse> {
        const { campaignId } = data

        if (!campaignId) {
            return {
                success: false,
                error: "Campaign ID is required",
            }
        }

        await this.campaignCacheService.deleteCampaign(campaignId)
        await this.campaignCacheService.invalidateAll(campaignId)

        return {
            success: true,
            error: null,
        }
    }

    @GrpcMethod("CampaignService", "UpdateCampaignReceivedAmount")
    async updateCampaignReceivedAmount(
        data: UpdateCampaignReceivedAmountRequest,
    ): Promise<UpdateCampaignReceivedAmountResponse> {
        const { campaignId, amount } = data

        if (!campaignId || !amount) {
            return {
                success: false,
                error: "Campaign ID and amount are required",
            }
        }

        try {
            await this.campaignService.addReceivedAmount(
                campaignId,
                BigInt(amount),
            )

            return {
                success: true,
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                error: error.message || "Failed to update campaign received amount",
            }
        }
    }
}