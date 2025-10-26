import { Module } from "@nestjs/common"
import { DonorService } from "./services/donor.service"
import { DonationProcessorService } from "./services/donation-processor.service"
import { DonationWebhookService } from "./services/donation-webhook.service"
import { DonorRepository } from "./repositories/donor.repository"
import { DonorMutationResolver } from "./resolvers/donor/mutations/donor-mutation.resolver"
import { DonorQueryResolver } from "./resolvers/donor/queries/donor-query.resolver"
import { DonationWebhookController } from "./controllers/donation-webhook.controller"
import { CampaignModule } from "../campaign/campaign.module"
import { PrismaClient } from "../generated/campaign-client"
import { AuthLibModule } from "@libs/auth"
import { SqsModule } from "@libs/aws-sqs"
import { PayOSModule } from "@libs/payos"

@Module({
    imports: [CampaignModule, AuthLibModule, SqsModule, PayOSModule],
    controllers: [DonationWebhookController],
    providers: [
        DonorService,
        DonationProcessorService,
        DonationWebhookService,
        DonorRepository,
        DonorMutationResolver,
        DonorQueryResolver,
        PrismaClient,
    ],
    exports: [DonorService, DonationProcessorService, DonorRepository],
})
export class DonationModule {}
