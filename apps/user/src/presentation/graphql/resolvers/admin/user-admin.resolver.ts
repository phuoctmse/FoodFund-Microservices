import { Args, Mutation, Resolver, ID, Query, Int } from "@nestjs/graphql"
import { RequireRole } from "libs/auth"
import { ValidationPipe } from "@nestjs/common"
import { UpdateUserAccountInput } from "@app/user/src/application/dtos"
import { UserAdminService } from "@app/user/src/application/services"
import { UserProfileSchema } from "@app/user/src/domain/entities"
import { Role } from "@libs/databases"

@Resolver()
export class UserAdminResolver {
    constructor(
        private readonly userAdminService: UserAdminService,
    ) {}

    @Query(() => [UserProfileSchema], {
        name: "getAllUsers",
        description: "Get all users with pagination (Admin only)",
    })
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

    @Mutation(() => UserProfileSchema, {
        description: "Update user account information (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async updateUserAccount(
        @Args("userId", { type: () => ID }) userId: string,
        @Args("input", new ValidationPipe()) input: UpdateUserAccountInput,
    ) {
        return this.userAdminService.updateUserAccount(userId, input) as any
    }
}
