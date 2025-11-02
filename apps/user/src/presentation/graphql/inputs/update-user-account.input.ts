import { InputType, Field } from "@nestjs/graphql"
import {
    IsString,
    IsEmail,
    IsOptional,
    IsBoolean,
} from "class-validator"
import { Transform } from "class-transformer"
import { IsVietnamesePhone } from "@libs/validation"

/**
 * GraphQL Input: Update User Account (Admin)
 * Input for admins to update user accounts
 */
@InputType()
export class UpdateUserAccountInput {
    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Full name must be a string" })
    @Transform(({ value }) => value?.trim())
        full_name?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsEmail({}, { message: "Please provide a valid email address" })
    @Transform(({ value }) => value?.toLowerCase().trim())
        email?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Phone number must be a string" })
    @IsVietnamesePhone({
        message: "Please provide a valid Vietnamese phone number",
    })
    @Transform(({ value }) => value?.trim())
        phone_number?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Avatar URL must be a string" })
        avatar_url?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString({ message: "Bio must be a string" })
        bio?: string

    @Field({ defaultValue: false })
    @IsOptional()
    @IsBoolean({ message: "Active status must be boolean" })
        is_active?: boolean
}
