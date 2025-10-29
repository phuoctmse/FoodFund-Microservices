import { Module } from "@nestjs/common"
import { CampaignService } from "./services/campaign.service"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { PrismaClient } from "../generated/campaign-client"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignSchedulerService } from "./workers/schedulers/campaign-scheduler.service"
import { CampaignStatusJob } from "./workers/campaign-status.job"
import { CampaignCategoryModule } from "../campaign-category/campaign-category.module"
import { CampaignQueryResolver } from "./resolver/queries/campaign-query.resolver"
import { CampaignMutationResolver } from "./resolver/mutations/campaign-mutation.resolver"
import { AuthorizationService } from "../shared/services/authorization.service"
import { UserResolver } from "../shared/resolver/users.resolver"
import { CampaignGrpcService, CampaignCommonGrpcService } from "./grpc"
import { CampaignCacheService, PrismaCampaignService } from "./services"
import { CampaignRepository } from "./repository"
import { HealthController } from "./controller"

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
        CampaignCacheService,
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
        CampaignCacheService,
        CampaignGrpcService,
    ],
})
export class CampaignModule {}
