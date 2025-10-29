import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { GrpcServerService } from "libs/grpc"
import { CampaignCommonGrpcService } from "./common"

@Injectable()
export class CampaignGrpcService implements OnModuleInit {
    private readonly logger = new Logger(CampaignGrpcService.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly campaignCommonGrpcService: CampaignCommonGrpcService,
    ) {}

    async onModuleInit() {
        this.logger.log("Campaign gRPC service implementation ready")
        this.logger.log(
            `Will listen on port: ${process.env.CAMPAIGN_GRPC_PORT || "50003"}`,
        )
    }

    public getImplementation() {
        return {
            // Health check
            Health: this.health.bind(this),

            // Campaign service methods
            GetCampaign: this.getCampaign.bind(this),
        }
    }

    // Health check implementation
    private async health(call: any, callback: any) {
        const response = {
            healthy: true,
            message: "Campaign service is healthy",
        }

        callback(null, response)
    }

    // Get campaign by ID
    private async getCampaign(call: any, callback: any) {
        return this.campaignCommonGrpcService.getCampaign(call, callback)
    }
}
