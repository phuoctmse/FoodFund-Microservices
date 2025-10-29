import { Resolver } from "@nestjs/graphql"
import { DonationAdminService } from "../../../services/admin"

@Resolver()
export class AdminQueryResolver {
    constructor(private readonly donationAdminService: DonationAdminService) {}
}
