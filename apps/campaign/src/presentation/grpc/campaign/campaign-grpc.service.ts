import { CampaignPhaseRepository } from "@app/campaign/src/application/repositories/campaign-phase.repository"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"
import { Controller, Injectable } from "@nestjs/common"
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
    }>
    error: string | null
}

interface HealthRequest {}

interface HealthResponse {
    healthy: boolean
    message: string
}
@Controller()
@Injectable()
export class CampaignGrpcService {
    constructor(
        private readonly campaignService: CampaignService,
        private readonly campaignPhaseRepository: CampaignPhaseRepository,
    ) {}

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
                fundraisingStartDate: toISOString(campaign.fundraisingStartDate),
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
                ingredientPurchaseDate: phase.ingredientPurchaseDate.toISOString(),
                cookingDate: phase.cookingDate.toISOString(),
                deliveryDate: phase.deliveryDate.toISOString(),
            })),
            error: null,
        }
    }
}
