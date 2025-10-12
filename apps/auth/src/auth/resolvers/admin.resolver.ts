import { Args, Resolver, Mutation, Context } from "@nestjs/graphql"
import { CreateStaffAccountResponse } from "../models"
import { CreateStaffAccountInput } from "../dto"
import { RequireRole } from "libs/auth"
import { Role } from "libs/databases/prisma/schemas/enums/user.enums"
import { AuthAdminService } from "../services/auth-admin.service"

@Resolver()
export class AdminResolver {
    constructor(private readonly adminService: AuthAdminService) {}

    @Mutation(() => CreateStaffAccountResponse)
    @RequireRole(Role.ADMIN)
    async createStaffAccount(
        @Args("input") input: CreateStaffAccountInput,
        @Context() context: any,
    ): Promise<CreateStaffAccountResponse> {
        const adminUser = context.req.user
        return this.adminService.createStaffAccount(input, adminUser)
    }
}
