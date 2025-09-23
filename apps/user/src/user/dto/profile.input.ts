import { InputType, Field } from "@nestjs/graphql"
import { IsString, IsOptional, IsEnum, IsNumber, IsInt, Min } from "class-validator"
import { VerificationStatus, AvailabilityStatus } from "libs/databases/prisma/schemas"

@InputType()
export class UpdateDonorProfileInput {
    @Field(() => Number, { nullable: true, description: "Total number of donations made" })
    @IsOptional()
    @IsInt()
    @Min(0)
        donation_count?: number

    @Field(() => Number, { nullable: true, description: "Total amount donated" })
    @IsOptional()
    @IsNumber()
        total_donated?: bigint
}

@InputType()
export class UpdateKitchenStaffProfileInput {
    @Field(() => Number, { nullable: true, description: "Total batches prepared" })
    @IsOptional()
    @IsInt()
    @Min(0)
        total_batch_prepared?: number
}

@InputType()
export class UpdateFundraiserProfileInput {
    @Field(() => String, { nullable: true, description: "Full name" })
    @IsOptional()
    @IsString()
        full_name?: string

    @Field(() => String, { nullable: true, description: "Organization address" })
    @IsOptional()
    @IsString()
        organization_address?: string

    @Field(() => VerificationStatus, { nullable: true, description: "Verification status" })
    @IsOptional()
    @IsEnum(VerificationStatus)
        verification_status?: VerificationStatus

    @Field(() => Number, { nullable: true, description: "Total campaigns created" })
    @IsOptional()
    @IsInt()
    @Min(0)
        total_campaign_created?: number
}

@InputType()
export class UpdateDeliveryStaffProfileInput {
    @Field(() => AvailabilityStatus, { nullable: true, description: "Current availability status" })
    @IsOptional()
    @IsEnum(AvailabilityStatus)
        availability_status?: AvailabilityStatus

    @Field(() => Number, { nullable: true, description: "Total deliveries completed" })
    @IsOptional()
    @IsInt()
    @Min(0)
        total_deliveries?: number
}
