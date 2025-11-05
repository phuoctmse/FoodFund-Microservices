import { InputType, Field } from "@nestjs/graphql"
import { IsString, IsOptional, MinLength, MaxLength } from "class-validator"
import { IsVietnamesePhone } from "@libs/validation"

@InputType()
export class UpdateMyProfileInput {
    @Field(() => String, { nullable: true, description: "User's full name" })
    @IsOptional()
    @IsString()
    @MinLength(2, { message: "Full name must be at least 2 characters" })
    @MaxLength(100, { message: "Full name cannot exceed 100 characters" })
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
    @MaxLength(500, { message: "Address cannot exceed 500 characters" })
        address?: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: "Bio cannot exceed 1000 characters" })
        bio?: string
}
