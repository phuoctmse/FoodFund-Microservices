import { Resolver, Mutation, Args, ID } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { UserService } from "../user.service"
import {
    DonorProfileSchema,
    KitchenStaffProfileSchema,
    FundraiserProfileSchema,
    DeliveryStaffProfileSchema,
} from "libs/databases/prisma/schemas"
import {
    UpdateDonorProfileInput,
    UpdateKitchenStaffProfileInput,
    UpdateFundraiserProfileInput,
    UpdateDeliveryStaffProfileInput,
} from "../dto/profile.input"

@Resolver(() => DonorProfileSchema)
export class DonorProfileResolver {
    constructor(private readonly userService: UserService) {}

    @Mutation(() => DonorProfileSchema)
    async updateDonorProfile(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateDonorProfileInput", new ValidationPipe())
            updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        return this.userService.updateDonorProfile(id, updateDonorProfileInput)
    }

    @Mutation(() => DonorProfileSchema)
    async deleteDonorProfile(@Args("id", { type: () => ID }) id: string) {
        return this.userService.deleteDonorProfile(id)
    }
}

@Resolver(() => KitchenStaffProfileSchema)
export class KitchenStaffProfileResolver {
    constructor(private readonly userService: UserService) {}

    @Mutation(() => KitchenStaffProfileSchema)
    async updateKitchenStaffProfile(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateKitchenStaffProfileInput", new ValidationPipe())
            updateKitchenStaffProfileInput: UpdateKitchenStaffProfileInput,
    ) {
        return this.userService.updateKitchenStaffProfile(
            id,
            updateKitchenStaffProfileInput,
        )
    }

    @Mutation(() => KitchenStaffProfileSchema)
    async deleteKitchenStaffProfile(
        @Args("id", { type: () => ID }) id: string,
    ) {
        return this.userService.deleteKitchenStaffProfile(id)
    }
}

@Resolver(() => FundraiserProfileSchema)
export class FundraiserProfileResolver {
    constructor(private readonly userService: UserService) {}

    @Mutation(() => FundraiserProfileSchema)
    async updateFundraiserProfile(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateFundraiserProfileInput", new ValidationPipe())
            updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    ) {
        return this.userService.updateFundraiserProfile(
            id,
            updateFundraiserProfileInput,
        )
    }

    @Mutation(() => FundraiserProfileSchema)
    async deleteFundraiserProfile(@Args("id", { type: () => ID }) id: string) {
        return this.userService.deleteFundraiserProfile(id)
    }
}

@Resolver(() => DeliveryStaffProfileSchema)
export class DeliveryStaffProfileResolver {
    constructor(private readonly userService: UserService) {}

    @Mutation(() => DeliveryStaffProfileSchema)
    async updateDeliveryStaffProfile(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateDeliveryStaffProfileInput", new ValidationPipe())
            updateDeliveryStaffProfileInput: UpdateDeliveryStaffProfileInput,
    ) {
        return this.userService.updateDeliveryStaffProfile(
            id,
            updateDeliveryStaffProfileInput,
        )
    }

    @Mutation(() => DeliveryStaffProfileSchema)
    async deleteDeliveryStaffProfile(
        @Args("id", { type: () => ID }) id: string,
    ) {
        return this.userService.deleteDeliveryStaffProfile(id)
    }
}
