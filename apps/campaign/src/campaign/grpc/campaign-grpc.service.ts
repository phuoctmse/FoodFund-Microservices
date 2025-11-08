import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { CampaignCommonGrpcService } from "./common"
import { CampaignPhaseRepository } from "../../campaign-phase"
import { GrpcMethod } from "@nestjs/microservices"

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

@Injectable()
export class CampaignGrpcService implements OnModuleInit {
    private readonly logger = new Logger(CampaignGrpcService.name)

    constructor(
        private readonly campaignCommonGrpcService: CampaignCommonGrpcService,
        private readonly campaignPhaseRepository: CampaignPhaseRepository,
    ) {}

    async onModuleInit() {
        this.logger.log("Campaign gRPC service implementation ready")
        this.logger.log(
            `Will listen on port: ${process.env.CAMPAIGN_GRPC_PORT || "50003"}`,
        )
    }

    public getImplementation() {
        return {
            Health: this.health.bind(this),
            GetCampaign: this.getCampaign.bind(this),
            GetCampaignIdByPhaseId: this.getCampaignIdByPhaseId.bind(this),
            GetCampaignPhases: this.getCampaignPhases.bind(this),
        }
    }

    private async health(call: any, callback: any) {
        const response = {
            healthy: true,
            message: "Campaign service is healthy",
        }

        callback(null, response)
    }

    private async getCampaign(call: any, callback: any) {
        return this.campaignCommonGrpcService.getCampaign(call, callback)
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

        const phase = await this.campaignPhaseRepository.findById(phaseId)

        if (!phase) {
            return {
                success: false,
                campaignId: null,
                error: "Campaign phase not found",
            }
        }

        return {
            success: true,
            campaignId: phase.campaignId,
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
            })),
            error: null,
        }
    }
}
