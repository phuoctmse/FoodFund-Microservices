import { IsVietnamesePhone } from "@libs/validation"
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
    @Field(() => String, { description: "User's full name" })
    @IsString()
        full_name: string

    @Field(() => String, { nullable: true, description: "User's avatar URL" })
    @IsOptional()
    @IsString()
        avatar_url?: string

    @Field(() => String, { nullable: true, description: "User's phone number" })
    @IsOptional()
    @IsVietnamesePhone()
        phone_number?: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
    @IsOptional()
    @IsString()
        bio?: string
}
