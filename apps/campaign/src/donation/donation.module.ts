import { Module } from "@nestjs/common"
import { DonationService } from "./donation.service"
import { DonationRepository } from "./donation.repository"
import { DonationMutationResolver } from "./resolvers/mutations/donation-mutation.resolver"
import { DonationQueryResolver } from "./resolvers/queries/donation-query.resolver"
import { CampaignModule } from "../campaign/campaign.module"
import { PrismaClient } from "../generated/campaign-client"

@Module({
    imports: [CampaignModule],
    controllers: [],
    providers: [
        DonationService,
        DonationRepository,
        DonationMutationResolver,
        DonationQueryResolver,
        PrismaClient,
    ],
    exports: [DonationService, DonationRepository],
})
export class DonationModule {}
