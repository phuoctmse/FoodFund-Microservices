import { Module } from "@nestjs/common"
import { PrismaClient } from "../generated/campaign-client"
import {
    CampaignCategoryCacheService,
    CampaignCategoryService,
} from "./services"
import { CampaignCategoryRepository } from "./repository"
import {
    CampaignCategoryMutationResolver,
    CampaignCategoryQueryResolver,
} from "./resolvers"
import { AuthorizationService } from "../shared"
import { PrismaCampaignService } from "../campaign/services"

@Module({
    imports: [],
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
