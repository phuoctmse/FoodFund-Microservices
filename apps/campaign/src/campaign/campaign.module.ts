import { Module } from "@nestjs/common"
import { CampaignService } from "./campaign.service"
import { CampaignRepository } from "./campaign.repository"
import { HealthController } from "./health.controller"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { PrismaClient } from "../generated/campaign-client"
import { PrismaCampaignService } from "./prisma-campaign.service"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignSchedulerService } from "./workers/schedulers/campaign-scheduler.service"
import { CampaignStatusJob } from "./workers/campaign-status.job"
import { CampaignCategoryModule } from "../campaign-category/campaign-category.module"
import { CampaignQueryResolver } from "./resolver/queries/campaign-query.resolver"
import { CampaignMutationResolver } from "./resolver/mutations/campaign-mutation.resolver"
import { AuthorizationService } from "../shared/services/authorization.service"
import { UserResolver } from "../shared/resolver/users.resolver"
import { CampaignGrpcService, CampaignCommonGrpcService } from "./grpc"

@Module({
    imports: [
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        CampaignCategoryModule,
    ],
    providers: [
        PrismaCampaignService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaCampaignService) => service["client"],
            inject: [PrismaCampaignService],
        },
        SpacesUploadService,
        CampaignService,
        CampaignQueryResolver,
        CampaignMutationResolver,
        CampaignRepository,
        CampaignSchedulerService,
        CampaignStatusJob,
        UserResolver,
        AuthorizationService,
        CampaignGrpcService,
        CampaignCommonGrpcService,
    ],
    controllers: [HealthController],
    exports: [
        CampaignService,
        CampaignRepository,
        CampaignSchedulerService,
        PrismaCampaignService,
        CampaignGrpcService,
    ],
})
export class CampaignModule {}
