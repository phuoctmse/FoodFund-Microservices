import { Module } from "@nestjs/common"
import { DonorService } from "./services/donor.service"
import { DonationProcessorService } from "./services/donation-processor.service"
import { DonationWebhookService } from "./services/donation-webhook.service"
import { SepayWebhookService } from "./services/sepay-webhook.service"
import { DonationAdminService } from "./services/admin"
import { DonorRepository } from "./repositories/donor.repository"
import { DonorMutationResolver } from "./resolvers/donor/mutations/donor-mutation.resolver"
import { DonorQueryResolver } from "./resolvers/donor/queries/donor-query.resolver"
import { AdminQueryResolver, AdminMutationResolver } from "./resolvers/admin"
import { DonationWebhookController } from "./controllers/donation-webhook.controller"
import { SepayWebhookController } from "./controllers/sepay-webhook.controller"
import { CampaignModule } from "../campaign/campaign.module"
import { PrismaClient } from "../generated/campaign-client"
import { AuthLibModule } from "@libs/auth"
import { SqsModule } from "@libs/aws-sqs"
import { GrpcModule } from "@libs/grpc"
import { RedisModule } from "@libs/redis"
import { UserClientService } from "../shared/services/user-client.service"
import { UserDataLoader } from "../shared/dataloaders/user.dataloader"
import { PayosCleanupService } from "./services/payos-cleanup.service"

@Module({
    imports: [CampaignModule, AuthLibModule, SqsModule, GrpcModule, RedisModule],
    controllers: [DonationWebhookController, SepayWebhookController],
    providers: [
        DonorService,
        DonationProcessorService,
        DonationWebhookService,
        SepayWebhookService,
        PayosCleanupService,
        DonationAdminService,
        DonorRepository,
        DonorMutationResolver,
        DonorQueryResolver,
        AdminQueryResolver,
        AdminMutationResolver,
        UserClientService,
        UserDataLoader,
        PrismaClient,
    ],
    exports: [DonorService, DonationProcessorService, DonorRepository],
})
export class DonationModule {}
