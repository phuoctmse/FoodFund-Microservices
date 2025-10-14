import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { UpdateDeliveryStaffProfileInput } from "../../dto/profile.input"
import { DeliveryStaffService } from "../../services/delivery-staff/delivery-staff.service"
import { CurrentUser, RequireRole } from "libs/auth"

@Resolver()
export class DeliveryStaffProfileResolver {
    constructor(private readonly deliveryStaffService: DeliveryStaffService) {}

    // Individual role profile queries replaced by common getMyRoleProfile in UserQueryResolver
    // @Query(() => DeliveryStaffProfileSchema)
    // @RequireRole(Role.DELIVERY_STAFF)
    // async getDeliveryStaffProfile(@CurrentUser() user: { cognito_id: string }) {
    //     return this.deliveryStaffService.getProfile(user.cognito_id)
    // }

    // Update/Delete functionality removed - Delivery staff can only view their profile
    // @Mutation(() => DeliveryStaffProfileSchema)
    // async updateDeliveryStaffProfile(
    //     @Args("id", { type: () => ID }) id: string,
    //     @Args("updateDeliveryStaffProfileInput", new ValidationPipe())
    //         updateDeliveryStaffProfileInput: UpdateDeliveryStaffProfileInput,
    // ) {
    //     return this.deliveryStaffService.updateDeliveryStaffProfile(
    //         id,
    //         updateDeliveryStaffProfileInput,
    //     )
    // }

    // @Mutation(() => DeliveryStaffProfileSchema)
    // async deleteDeliveryStaffProfile(
    //     @Args("id", { type: () => ID }) id: string,
    // ) {
    //     return this.deliveryStaffService.deleteDeliveryStaffProfile(id)
    // }
}
