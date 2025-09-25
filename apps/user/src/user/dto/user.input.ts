import { InputType, Field } from "@nestjs/graphql"
import {
    IsString,
    IsEmail,
    IsPhoneNumber,
    IsOptional,
    IsEnum,
    IsBoolean,
} from "class-validator"
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

    @Field(() => String, { nullable: true, description: "User email address" })
    @IsOptional()
    @IsEmail()
        email?: string

    @Field(() => String, { nullable: true, description: "User's phone number" })
    @IsOptional()
    @IsPhoneNumber()
        phone_number?: string

    @Field(() => Role, {
        nullable: true,
        description: "User's role in the system",
    })
    @IsOptional()
    @IsEnum(Role)
        role?: Role

    @Field(() => Boolean, {
        nullable: true,
        description: "Whether the user is active",
    })
    @IsOptional()
    @IsBoolean()
        is_active?: boolean

    @Field(() => String, { nullable: true, description: "Unique username" })
    @IsOptional()
    @IsString()
        user_name?: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
    @IsOptional()
    @IsString()
        bio?: string
}
