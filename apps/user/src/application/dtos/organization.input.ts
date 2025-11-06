import { IsVietnamesePhone } from "@libs/validation"
import { Field, InputType } from "@nestjs/graphql"
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    IsUrl,
    IsOptional,
    IsEnum,
    IsUUID,
} from "class-validator"
import { JoinOrganizationRole } from "./join-organization-role.enum"

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

@InputType()
export class JoinOrganizationInput {
    @Field()
    @IsNotEmpty({ message: "Organization ID is required" })
    @IsUUID("4", { message: "Organization ID must be a valid UUID" })
        organization_id: string

    @Field(() => JoinOrganizationRole, {
        description: "Role to request: KITCHEN_STAFF or DELIVERY_STAFF only",
    })
    @IsEnum(JoinOrganizationRole, {
        message: "Role must be one of: KITCHEN_STAFF, DELIVERY_STAFF",
    })
        requested_role: JoinOrganizationRole
}
