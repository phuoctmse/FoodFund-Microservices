import { Module } from "@nestjs/common"
import { DonationService } from "./services/donation.service"
import { DonationProcessorService } from "./services/donation-processor.service"
import { DonationRepository } from "./repositories/donation.repository"
import { DonationMutationResolver } from "./resolvers/mutations/donation-mutation.resolver"
import { DonationQueryResolver } from "./resolvers/queries/donation-query.resolver"
import { CampaignModule } from "../campaign/campaign.module"
import { PrismaClient } from "../generated/campaign-client"
import { AuthLibModule } from "@libs/auth"
import { SqsModule } from "@libs/aws-sqs"

@Module({
    imports: [CampaignModule, AuthLibModule, SqsModule],
    controllers: [],
    providers: [
        DonationService,
        DonationProcessorService,
        DonationRepository,
        DonationMutationResolver,
        DonationQueryResolver,
        PrismaClient,
    ],
    exports: [DonationService, DonationProcessorService, DonationRepository],
})
export class DonationModule {}
