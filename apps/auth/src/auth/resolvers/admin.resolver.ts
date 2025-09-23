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
} from "../models"
import {
    CreateStaffAccountInput,
} from "../dto"
import { RequireAdmin } from "libs/auth"
import { AuthUser } from "../models"
import { AdminService } from "../services"

@Resolver()
export class AdminResolver {
    constructor(private adminService: AdminService) {}

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