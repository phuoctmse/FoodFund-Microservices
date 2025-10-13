import { AwsCognitoModule } from "@libs/aws-cognito"
import { Module } from "@nestjs/common"
import { CampaignCategoryService } from "./campaign-category.service"
import { CampaignCategoryRepository } from "./campaign-category.repository"
import { CampaignCategoryResolver } from "./campaign-category.resolver"
import { PrismaClient } from "../generated/campaign-client"
import { PrismaCampaignService } from "../campaign/prisma-campaign.service"

@Module({
    imports: [
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
    ],
    providers: [
        PrismaCampaignService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaCampaignService) => service["client"],
            inject: [PrismaCampaignService],
        },
        CampaignCategoryService,
        CampaignCategoryRepository,
        CampaignCategoryResolver,
    ],
    controllers: [],
    exports: [CampaignCategoryService, CampaignCategoryRepository],
})
export class CampaignCategoryModule {}
