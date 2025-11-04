import { Args, Resolver, Mutation, Context } from "@nestjs/graphql"
import { AuthAdminService } from "../../../application/services/auth-admin.service"

@Resolver()
export class AdminResolver {
    constructor(private readonly adminService: AuthAdminService) {}
}
