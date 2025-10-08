import {
    Resolver,
    Query,
    Args,
    ID,
    ResolveReference,
    Context,
    createUnionType,
    ObjectType,
    Field,
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
import { DataLoaderService } from "../../services/common/dataloader.service"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, RequireRole } from "libs/auth"
import { User } from "apps/user/src/generated/user-client"
import { OrganizationService } from "../../services"

// Create a generic profile response that works for all roles
@ObjectType()
export class RoleProfileResponse {
    @Field(() => Role)
        role: Role

    @Field(() => String)
        message: string

    @Field(() => DonorProfileSchema, { nullable: true })
        donorProfile?: DonorProfileSchema

    @Field(() => FundraiserProfileSchema, { nullable: true })
        fundraiserProfile?: FundraiserProfileSchema

    @Field(() => KitchenStaffProfileSchema, { nullable: true })
        kitchenStaffProfile?: KitchenStaffProfileSchema

    @Field(() => DeliveryStaffProfileSchema, { nullable: true })
        deliveryStaffProfile?: DeliveryStaffProfileSchema

    @Field(() => String, { nullable: true })
        adminStats?: string
}

@Resolver(() => UserProfileSchema)
export class UserQueryResolver {
    constructor(
        private readonly userQueryService: UserQueryService,
        private readonly adminService: UserAdminService,
        private readonly donorService: DonorService,
        private readonly fundraiserService: FundraiserService,
        private readonly kitchenStaffService: KitchenStaffService,
        private readonly deliveryStaffService: DeliveryStaffService,
        private readonly organizationService: OrganizationService,
        private readonly dataLoaderService: DataLoaderService,
    ) {}

    @Query(() => UserHealthResponse, { name: "userHealth" })
    async userHealth(): Promise<UserHealthResponse> {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
        }
    }
    @Query(() => RoleProfileResponse, { name: "getMyRoleProfile" })
    @UseGuards(CognitoGraphQLGuard)
    async getMyRoleProfile(@CurrentUser() user: any): Promise<RoleProfileResponse> {
        
        if (!user) {
            throw new Error("User not authenticated")
        }
        
        const cognito_id = user.username as string

        if (!cognito_id) {
            throw new Error("User cognito_id not found")
        }
        
        // Get user info to determine role
        const userInfo = await this.userQueryService.findUserByCognitoId(cognito_id)
        if (!userInfo) {
            throw new Error("User not found")
        }

        const role = userInfo.role
        const response: RoleProfileResponse = {
            role,
            message: `Profile for ${role.toLowerCase()} user`,
        }
        
        // Route to appropriate service based on role
        switch (role) {
        case Role.DONOR: {
            response.donorProfile = (await this.donorService.getProfile(cognito_id as string)) as any
            break
        }
        case Role.FUNDRAISER: {
            // Sử dụng DataLoader cho optimization
            response.fundraiserProfile = (await this.dataLoaderService.getFundraiserProfileWithOrganization(cognito_id as string)) as any
            break
        }
        case Role.KITCHEN_STAFF: {
            // Sử dụng DataLoader cho optimization
            response.kitchenStaffProfile = (await this.dataLoaderService.getKitchenStaffProfileWithOrganization(cognito_id as string)) as any
            break
        }
        case Role.DELIVERY_STAFF: {
            // Sử dụng DataLoader cho optimization
            response.deliveryStaffProfile = (await this.dataLoaderService.getDeliveryStaffProfileWithOrganization(cognito_id as string)) as any
            break
            response.deliveryStaffProfile = (await this.organizationService.getDeliveryStaffProfile(cognito_id as string)) as any
            break
        }
        case Role.ADMIN: {
            const adminInfo = await this.adminService.getAdminProfile(cognito_id as string)
            response.adminStats = JSON.stringify(adminInfo)
            break
        }
        default:
            throw new Error(`Role profile not supported for role: ${role}`)
        }

        return response
    }

    // GraphQL Federation resolver
    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userQueryService.resolveReference(reference)
    }
}