import { IsVietnamesePhone, IsStrongPassword } from "@libs/validation"
import { InputType, Field } from "@nestjs/graphql"
import {
    IsString,
    IsEmail,
    IsPhoneNumber,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsNotEmpty,
    MinLength,
} from "class-validator"
import { Transform } from "class-transformer"
import { Role } from "libs/databases/prisma/schemas"

@InputType()
export class CreateUserInput {
    @Field(() => String, { description: "User's full name" })
    @IsString()
        full_name: string

    @Field(() => String, { description: "User's avatar URL" })
    @IsString()
        avatar_url: string

    @Field(() => String, { description: "User email address" })
    @IsEmail()
        email: string

    @Field(() => Role, { description: "User's role in the system" })
    @IsEnum(Role)
        role: Role

    @Field(() => String, { description: "Unique username" })
    @IsString()
        user_name: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
    @IsOptional()
    @IsString()
        bio?: string
}

@InputType()
export class UpdateUserInput {
    @Field(() => String, { nullable: true, description: "User's full name" })
    @IsOptional()
    @IsString()
        full_name?: string

    @Field(() => String, { nullable: true, description: "User's avatar URL" })
    @IsOptional()
    @IsString()
        avatar_url?: string

    @Field(() => String, { nullable: true, description: "User's phone number" })
    @IsOptional()
    @IsVietnamesePhone()
        phone_number?: string

    @Field(() => String, { nullable: true, description: "User's address" })
    @IsOptional()
    @IsString()
        address?: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
    @IsOptional()
    @IsString()
        bio?: string
}

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

    @Field({ nullable: true })
    @IsOptional()
    @IsBoolean({ message: "Active status must be boolean" })
        is_active?: boolean
}
