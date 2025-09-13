import { ObjectType, Field, ID } from "@nestjs/graphql"
import { Directive } from "@nestjs/graphql"
import { AbstractSchema } from "../abstract.schema"
import { Role, VerificationStatus, AvailabilityStatus } from "../enums/user.enums"

// Main User GraphQL Schema
@ObjectType()
@Directive("@key(fields: \"id\")")
export class UserProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User's full name"
    })
        fullName: string

    @Field(() => String, {
        description: "User's avatar URL"
    })
        avatarUrl: string

    @Field(() => String, {
        description: "User email address"
    })
        email: string

    @Field(() => String, {
        description: "User's phone number"
    })
        phoneNumber: string

    @Field(() => Role, {
        description: "User's role in the system"
    })
        role: Role

    @Field(() => Boolean, {
        description: "Whether the user is active",
        defaultValue: true
    })
        isActive: boolean

    @Field(() => String, {
        description: "Unique username"
    })
        userName: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description"
    })
        bio?: string

    @Field(() => DonorProfileSchema, { nullable: true })
        donorProfile?: DonorProfileSchema

    @Field(() => KitchenStaffProfileSchema, { nullable: true })
        kitchenStaffProfile?: KitchenStaffProfileSchema

    @Field(() => FundraiserProfileSchema, { nullable: true })
        fundraiserProfile?: FundraiserProfileSchema

    @Field(() => DeliveryStaffProfileSchema, { nullable: true })
        deliveryStaffProfile?: DeliveryStaffProfileSchema
}

// Donor Profile Schema
@ObjectType()
export class DonorProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID reference"
    })
        userId: string

    @Field(() => Number, {
        description: "Total number of donations made"
    })
        donationCount: number

    @Field(() => String, {
        description: "Total amount donated (as string for BigInt)"
    })
        totalDonated: string

    @Field(() => UserProfileSchema)
        user: UserProfileSchema
}

// Kitchen Staff Profile Schema
@ObjectType()
export class KitchenStaffProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID reference"
    })
        userId: string

    @Field(() => Number, {
        description: "Total batches prepared"
    })
        totalBatchPrepared: number

    @Field(() => UserProfileSchema)
        user: UserProfileSchema
}

// Fundraiser Profile Schema
@ObjectType()
export class FundraiserProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID reference"
    })
        userId: string

    @Field(() => String, {
        description: "Organization name"
    })
        organizationName: string

    @Field(() => String, {
        nullable: true,
        description: "Organization address"
    })
        organizationAddress?: string

    @Field(() => VerificationStatus, {
        description: "Verification status"
    })
        verificationStatus: VerificationStatus

    @Field(() => Number, {
        description: "Total campaigns created"
    })
        totalCampaignCreated: number

    @Field(() => UserProfileSchema)
        user: UserProfileSchema
}

// Delivery Staff Profile Schema
@ObjectType()
export class DeliveryStaffProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID reference"
    })
        userId: string

    @Field(() => AvailabilityStatus, {
        description: "Current availability status"
    })
        availabilityStatus: AvailabilityStatus

    @Field(() => Number, {
        description: "Total deliveries completed"
    })
        totalDeliveries: number

    @Field(() => UserProfileSchema)
        user: UserProfileSchema
}
