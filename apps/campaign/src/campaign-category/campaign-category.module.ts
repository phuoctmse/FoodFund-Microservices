import { AwsCognitoModule } from "@libs/aws-cognito"
import { Module } from "@nestjs/common"
import { CampaignCategoryService } from "./services/campaign-category.service"
import { PrismaClient } from "../generated/campaign-client"
import { PrismaCampaignService } from "../campaign/prisma-campaign.service"
import { CampaignCategoryCacheService } from "./services"
import { CampaignCategoryRepository } from "./repository"
import {
    CampaignCategoryMutationResolver,
    CampaignCategoryQueryResolver,
} from "./resolvers"
import { AuthorizationService } from "../shared"

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
        AuthorizationService,
        CampaignCategoryCacheService,
        CampaignCategoryService,
        CampaignCategoryRepository,
        CampaignCategoryQueryResolver,
        CampaignCategoryMutationResolver,
    ],
    controllers: [],
    exports: [
        CampaignCategoryService,
        CampaignCategoryRepository,
        CampaignCategoryCacheService,
    ],
})
export class CampaignCategoryModule {}
