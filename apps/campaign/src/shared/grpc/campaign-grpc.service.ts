import { AuthAuthenticationService } from "@app/auth/src/auth/services"
import { AwsCognitoService } from "@libs/aws-cognito"
import { envConfig } from "@libs/env"
import { GrpcServerService } from "@libs/grpc"
import { Injectable, OnModuleInit, Logger } from "@nestjs/common"

@Injectable()
export class CampaignGrpcService implements OnModuleInit {
    private readonly logger = new Logger(CampaignGrpcService.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly cognitoService: AwsCognitoService,
    ) {}

    async onModuleInit() {
        try {
            const env = envConfig()
            // Initialize gRPC server
            await this.grpcServer.initialize({
                port: env.grpc.campaign?.port || 50003,
                protoPath: "campaign.proto",
                packageName: "foodfund.campaign",
                serviceName: "CampaignService",
                implementation: this.getImplementation(),
            })

            // Start server
            await this.grpcServer.start()
        } catch (error) {
            this.logger.error("Failed to start Campaign gRPC service:", error)
        }
    }

    private getImplementation() {
        return {
            // Health check (required)
            Health: this.health.bind(this),

        }
    }

    // Health check implementation
    private async health(call: any, callback: any) {
        const response = {
            status: "healthy",
            service: "campaign-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }

        callback(null, response)
    }
}
