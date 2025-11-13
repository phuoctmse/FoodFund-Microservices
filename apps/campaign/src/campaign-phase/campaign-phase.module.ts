import { SentryModule } from "@libs/observability"
import { forwardRef, Module } from "@nestjs/common"
import { CampaignModule } from "../campaign/campaign.module"
import { PrismaCampaignService } from "../campaign/services"
import { PrismaClient } from "../generated/campaign-client"
import { CampaignPhaseService } from "./services"
import { CampaignPhaseRepository } from "./repository"
import {
    CampaignPhaseMutationResolver,
    CampaignPhaseQueryResolver,
} from "./resolvers"

@Module({
    imports: [
        SentryModule,
        forwardRef(() => CampaignModule),
    ],
    providers: [
        PrismaCampaignService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaCampaignService) => service["client"],
            inject: [PrismaCampaignService],
        },
        CampaignPhaseService,
        CampaignPhaseRepository,
        CampaignPhaseQueryResolver,
        CampaignPhaseMutationResolver,
    ],
    exports: [CampaignPhaseService, CampaignPhaseRepository],
})
export class CampaignPhaseModule {}
