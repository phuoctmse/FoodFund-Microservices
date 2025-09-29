import {
    Args,
    Mutation,
    Resolver,
    Context,
    ID,
    Query,
    Int,
} from "@nestjs/graphql"
import { CreateStaffAccountResponse } from "../../types/staff-response.model"
import {
    CreateStaffAccountInput,
    UpdateUserAccountInput,
} from "../../dto/user.input"
import { RequireRole } from "libs/auth"
import { Role, UserProfileSchema } from "libs/databases/prisma/schemas"
import { UserAdminService } from "../../services/admin/user-admin.service"
import { ValidationPipe } from "@nestjs/common"

@Resolver()
export class UserAdminResolver {
    constructor(private userAdminService: UserAdminService) {}

    // Admin Query: Get all users
    @Query(() => [UserProfileSchema], { name: "getAllUsers" })
    @RequireRole(Role.ADMIN)
    async getAllUsers(
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of users to skip",
        })
            offset: number = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of users to return (max 100)",
        })
            limit: number = 10,
    ) {
        const safeLimit = Math.min(Math.max(limit, 1), 100)
        const safeOffset = Math.max(offset, 0)

        return this.userAdminService.getAllUsers(safeOffset, safeLimit)
    }

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
