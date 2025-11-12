import { Module } from "@nestjs/common"
import { EventEmitterModule } from "@nestjs/event-emitter"
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
import { CampaignGrpcService } from "./grpc"
import { CampaignCacheService, PrismaCampaignService } from "./services"
import { CampaignRepository } from "./repository"
import { HealthController } from "./controller"
import { CampaignPhaseModule } from "../campaign-phase"
import { CampaignSettlementService } from "./services/campaign-settlement.service"
import { UserClientService } from "../shared/services/user-client.service"

@Module({
    imports: [
        EventEmitterModule.forRoot(),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        CampaignCategoryModule,
        CampaignPhaseModule,
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
        CampaignSettlementService,
        UserClientService,
        CampaignQueryResolver,
        CampaignMutationResolver,
        CampaignRepository,
        CampaignSchedulerService,
        CampaignStatusJob,
        UserResolver,
        AuthorizationService,
    ],
    controllers: [
        HealthController,
        CampaignGrpcService,
    ],
    exports: [
        CampaignService,
        CampaignRepository,
        CampaignSchedulerService,
        PrismaCampaignService,
        CampaignCacheService,
    ],
})
export class CampaignModule {}
