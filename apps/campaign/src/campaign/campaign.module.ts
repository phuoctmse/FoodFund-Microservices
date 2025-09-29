import { Module } from "@nestjs/common"
import { AuthLibModule } from "libs/auth/auth.module"
import { CampaignService } from "./campaign.service"
import { CampaignResolver } from "./campaign.resolver"
import { CampaignRepository } from "./campaign.repository"
import { JwtModule } from "@libs/jwt"
import { HealthController } from "./health.controller"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { CampaignSchedulerService } from "./workers/schedulers/campaign-scheduler.service"
import { CampaignStatusJob } from "./workers/schedulers/campaign-status.job"
import { ScheduleModule } from "@nestjs/schedule"

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
        CampaignSchedulerService,
        CampaignStatusJob,
    ],
    controllers: [HealthController],
    exports: [CampaignService, CampaignRepository, CampaignSchedulerService],
})
export class CampaignModule {}
