import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { KitchenStaffProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UpdateKitchenStaffProfileInput } from "../../dto/profile.input"
import { KitchenStaffService } from "../../services/kitchen-staff/kitchen-staff.service"
import { CurrentUser, RequireRole } from "libs/auth"

@Resolver(() => KitchenStaffProfileSchema)
export class KitchenStaffProfileResolver {
    constructor(private readonly kitchenStaffService: KitchenStaffService) {}

    // Individual role profile queries replaced by common getMyRoleProfile in UserQueryResolver
    // @Query(() => KitchenStaffProfileSchema)
    // @RequireRole(Role.KITCHEN_STAFF)
    // async getKitchenStaffProfile(@CurrentUser() user: { cognito_id: string }) {
    //     return this.kitchenStaffService.getProfile(user.cognito_id)
    // }

    // Update/Delete functionality removed - Kitchen staff can only view their profile
    // @Mutation(() => KitchenStaffProfileSchema)
    // async updateKitchenStaffProfile(
    //     @Args("id", { type: () => ID }) id: string,
    //     @Args("updateKitchenStaffProfileInput", new ValidationPipe())
    //         updateKitchenStaffProfileInput: UpdateKitchenStaffProfileInput,
    // ) {
    //     return this.kitchenStaffService.updateKitchenStaffProfile(
    //         id,
    //         updateKitchenStaffProfileInput,
    //     )
    // }

    // @Mutation(() => KitchenStaffProfileSchema)
    // async deleteKitchenStaffProfile(
    //     @Args("id", { type: () => ID }) id: string,
    // ) {
    //     return this.kitchenStaffService.deleteKitchenStaffProfile(id)
    // }
}