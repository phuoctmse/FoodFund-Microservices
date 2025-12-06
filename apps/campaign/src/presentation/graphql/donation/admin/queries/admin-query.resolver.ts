import { DonationAdminService } from "@app/campaign/src/application/services/donation/admin"
import { Resolver } from "@nestjs/graphql"

@Resolver()
export class AdminQueryResolver {
    constructor(private readonly donationAdminService: DonationAdminService) {}
}
