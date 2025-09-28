import { Module } from "@nestjs/common"
import { AuthLibModule } from "libs/auth/auth.module"
import { CampaignService } from "./campaign.service"
import { CampaignResolver } from "./campaign.resolver"
import { CampaignRepository } from "./campaign.repository"
import { JwtModule } from "@libs/jwt"
import { HealthController } from "./health.controller"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignSchedulerService } from "./services/campaign-scheduler.service"
import { CampaignStatusJob } from "./jobs/campaign-status.job"
import { ScheduleModule } from "@nestjs/schedule"
import { CampaignMapper } from "./campaign.mapper"

@Module({
    imports: [
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        AuthLibModule,
        JwtModule.register({
            isGlobal: false,
            useGlobalImports: true,
        }),
        ScheduleModule.forRoot(),
    ],
    providers: [
        SpacesUploadService,
        CampaignService,
        CampaignResolver,
        CampaignRepository,
        CampaignMapper,
        CampaignSchedulerService,
        CampaignStatusJob,
    ],
    controllers: [HealthController],
    exports: [CampaignService, CampaignRepository, CampaignSchedulerService],
})
export class CampaignModule {}
