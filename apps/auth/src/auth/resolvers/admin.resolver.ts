import {
    Args,
    ID,
    Query,
    Resolver,
    Mutation,
    Context,
} from "@nestjs/graphql"
import {
    CreateStaffAccountResponse,
    CreateFundraiserAccountResponse,
} from "../models"
import {
    CreateStaffAccountInput,
    CreateFundraiserAccountInput,
} from "../dto"
import { RequireAdmin } from "libs/auth"
import { AuthUser } from "../models"
import { AdminService } from "../services"

@Resolver()
export class AdminResolver {
    constructor(private adminService: AdminService) {}

    @Mutation(() => CreateFundraiserAccountResponse)
    @RequireAdmin()
    async createFundraiserAccount(
        @Args("input") input: CreateFundraiserAccountInput,
        @Context() context: any,
    ): Promise<CreateFundraiserAccountResponse> {
        const adminUser = context.req.user
        return this.adminService.createFundraiserAccount(input, adminUser)
    }

    @Mutation(() => CreateStaffAccountResponse)
    @RequireAdmin()
    async createStaffAccount(
        @Args("input") input: CreateStaffAccountInput,
        @Context() context: any,
    ): Promise<CreateStaffAccountResponse> {
        const adminUser = context.req.user
        return this.adminService.createStaffAccount(input, adminUser)
    }
}