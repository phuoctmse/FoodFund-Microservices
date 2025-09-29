import {
    Resolver,
    Query,
    Args,
    ID,
    ResolveReference,
    Context,
    createUnionType,
} from "@nestjs/graphql"
import { 
    UserProfileSchema, 
    Role, 
    DonorProfileSchema,
    FundraiserProfileSchema,
    KitchenStaffProfileSchema,
    DeliveryStaffProfileSchema 
} from "libs/databases/prisma/schemas"
import { UserHealthResponse } from "../../types/health-response.model"
import { UserQueryService } from "../../services/common/user-query.service"
import { UserAdminService } from "../../services/admin/user-admin.service"
import { DonorService } from "../../services/donor/donor.service"
import { FundraiserService } from "../../services/fundraiser/fundraiser.service"
import { KitchenStaffService } from "../../services/kitchen-staff/kitchen-staff.service"
import { DeliveryStaffService } from "../../services/delivery-staff/delivery-staff.service"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, RequireRole } from "libs/auth"

// Create union type for role-specific profiles
export const RoleProfileUnion = createUnionType({
    name: "RoleProfile",
    types: () => [DonorProfileSchema, FundraiserProfileSchema, KitchenStaffProfileSchema, DeliveryStaffProfileSchema],
    resolveType: (obj) => {
        if (obj.total_donated !== undefined) return DonorProfileSchema
        if (obj.organization_name !== undefined) return FundraiserProfileSchema
        if (obj.cooking_experience !== undefined) return KitchenStaffProfileSchema
        if (obj.vehicle_type !== undefined) return DeliveryStaffProfileSchema
        return null
    }
})

@Resolver(() => UserProfileSchema)
export class UserQueryResolver {
    constructor(
        private readonly userQueryService: UserQueryService,
        private readonly adminService: UserAdminService,
        private readonly donorService: DonorService,
        private readonly fundraiserService: FundraiserService,
        private readonly kitchenStaffService: KitchenStaffService,
        private readonly deliveryStaffService: DeliveryStaffService,
    ) {}

    @Query(() => UserHealthResponse, { name: "userHealth" })
    async userHealth(): Promise<UserHealthResponse> {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
        }
    }

    @Query(() => [UserProfileSchema], { name: "users" })
    async findAllUsers(
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ) {
        return this.userQueryService.findAllUsers(skip, take)
    }

    @Query(() => UserProfileSchema, { name: "user" })
    async findUserById(@Args("id", { type: () => ID }) id: string) {
        return this.userQueryService.findUserById(id)
    }

    @Query(() => UserProfileSchema, { name: "userByEmail" })
    async findUserByEmail(@Args("email") email: string) {
        return this.userQueryService.findUserByEmail(email)
    }

    @Query(() => UserProfileSchema, { name: "userByUsername" })
    async findUserByUsername(@Args("user_name") user_name: string) {
        return this.userQueryService.findUserByUsername(user_name)
    }

    @Query(() => [UserProfileSchema], { name: "searchUsers" })
    async searchUsers(
        @Args("searchTerm") searchTerm: string,
        @Args("role", { nullable: true }) role?: string,
    ) {
        return this.userQueryService.searchUsers(searchTerm, role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "usersByRole" })
    async getUsersByRole(@Args("role") role: string) {
        return this.userQueryService.getUsersByRole(role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "activeUsers" })
    async getActiveUsers() {
        return this.userQueryService.getActiveUsers()
    }

    // Common role profile getter - replaces individual role profile resolvers
    @Query(() => RoleProfileUnion, { name: "getMyRoleProfile" })
    async getMyRoleProfile(@CurrentUser() user: { cognito_id: string; role?: Role }) {
        const userId = user.cognito_id
        
        // Get user info to determine role
        const userInfo = await this.userQueryService.findUserByCognitoId(userId)
        if (!userInfo) {
            throw new Error("User not found")
        }

        const role = userInfo.role
        
        // Route to appropriate service based on role
        switch (role) {
        case Role.DONOR:
            return this.donorService.getProfile(userId)
        case Role.FUNDRAISER:
            return this.fundraiserService.getProfile(userId)
        case Role.KITCHEN_STAFF:
            return this.kitchenStaffService.getProfile(userId)
        case Role.DELIVERY_STAFF:
            return this.deliveryStaffService.getProfile(userId)
        case Role.ADMIN:
            return this.adminService.getAdminProfile(userId)   
        default:
            throw new Error(`Role profile not supported for role: ${role}`)
        }
    }

    // GraphQL Federation resolver
    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userQueryService.resolveReference(reference)
    }
}