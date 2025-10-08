import { IsVietnamesePhone } from "@libs/validation"
import { Field, InputType } from "@nestjs/graphql"
import { IsEmail, IsNotEmpty, IsString, IsUrl, IsOptional, IsEnum } from "class-validator"
import { Role } from "libs/databases/prisma/schemas"

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

    @Field()
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
    @IsNotEmpty()
    @IsString()
        organization_id: string

    @Field(() => Role, {
        description: "Role to request: KITCHEN_STAFF, DELIVERY_STAFF, or FUNDRAISER"
    })
    @IsEnum(Role, {
        message: "Role must be one of: KITCHEN_STAFF, DELIVERY_STAFF, FUNDRAISER"
    })
        requested_role: Role
}