import { Module } from "@nestjs/common"
import { CampaignService } from "./campaign.service"
import { CampaignRepository } from "./campaign.repository"
import { HealthController } from "./health.controller"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignSchedulerService } from "./workers/schedulers/campaign-scheduler.service"
import { CampaignStatusJob } from "./workers/campaign-status.job"
import { CampaignCategoryModule } from "../campaign-category/campaign-category.module"
import { UserRefResolver } from "../shared/resolver/user-ref.resolver"
import { CampaignResolver } from "./campaign.resolver"
import { AuthorizationService } from "../shared"

@Module({
    imports: [
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        CampaignCategoryModule,
    ],
    providers: [
        SpacesUploadService,
        CampaignService,
        CampaignResolver,
        CampaignRepository,
        CampaignSchedulerService,
        CampaignStatusJob,
        UserRefResolver,
        AuthorizationService,
    ],
    controllers: [HealthController],
    exports: [CampaignService, CampaignRepository, CampaignSchedulerService],
})
export class CampaignModule {}
