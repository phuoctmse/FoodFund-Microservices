import { Field, InputType } from "@nestjs/graphql"
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    IsUrl,
    IsOptional,
    IsEnum,
} from "class-validator"
import { IsVietnamesePhone } from "@libs/validation"

/**
 * Enum: Join Organization Role
 * Roles that can be requested when joining an organization
 */
export enum JoinOrganizationRole {
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF",
}

/**
 * GraphQL Input: Create Organization
 * Input for creating a new organization request
 */
@InputType()
export class CreateOrganizationInput {
    @Field()
    @IsNotEmpty()
    @IsString()
        name: string

    @Field()
    @IsNotEmpty()
    @IsString()
        activity_field: string

    @Field()
    @IsNotEmpty()
    @IsString()
        address: string

    @Field({ nullable: true })
    @IsOptional()
    @IsUrl()
        website?: string

    @Field()
    @IsNotEmpty()
    @IsString()
        description: string

    @Field()
    @IsNotEmpty()
    @IsString()
        representative_name: string

    @Field()
    @IsNotEmpty()
    @IsString()
        representative_identity_number: string

    @Field()
    @IsEmail()
        email: string

    @Field()
    @IsNotEmpty()
    @IsVietnamesePhone()
        phone_number: string
}

/**
 * GraphQL Input: Join Organization
 * Input for requesting to join an organization
 */
@InputType()
export class JoinOrganizationInput {
    @Field()
    @IsNotEmpty()
    @IsString()
        organization_id: string

    @Field(() => String, {
        description: "Role to request: KITCHEN_STAFF or DELIVERY_STAFF only",
    })
    @IsEnum(JoinOrganizationRole, {
        message: "Role must be one of: KITCHEN_STAFF, DELIVERY_STAFF",
    })
        requested_role: JoinOrganizationRole
}
