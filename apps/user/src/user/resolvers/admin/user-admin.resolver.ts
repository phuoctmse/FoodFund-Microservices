import { Args, Mutation, Resolver, Context, ID } from "@nestjs/graphql"
import { CreateStaffAccountResponse } from "../../types/staff-response.model"
import { CreateStaffAccountInput, UpdateUserAccountInput } from "../../dto/user.input"
import { RequireRole } from "libs/auth"
import { Role, UserProfileSchema } from "libs/databases/prisma/schemas"
import { UserAdminService } from "../../services/admin/user-admin.service"
import { ValidationPipe } from "@nestjs/common"

@Resolver()
export class UserAdminResolver {
    constructor(private userAdminService: UserAdminService) {}

    @Mutation(() => CreateStaffAccountResponse)
    @RequireRole(Role.ADMIN)
    async createStaffAccount(
        @Args("input") input: CreateStaffAccountInput,
        @Context() context: any,
    ): Promise<CreateStaffAccountResponse> {
        const adminUser = context.req.user
        return this.userAdminService.createStaffAccount(input, adminUser.id)
    }

    @Mutation(() => UserProfileSchema)
    @RequireRole(Role.ADMIN)
    async updateUserAccount(
        @Args("userId", { type: () => ID }) userId: string,
        @Args("input", new ValidationPipe()) input: UpdateUserAccountInput,
    ) {
        return this.userAdminService.updateUserAccount(userId, input) as any
    }
}