import { InputType, Field } from "@nestjs/graphql"
import { IsString, IsEmail, IsEnum, IsOptional } from "class-validator"
import { Transform } from "class-transformer"
import { Role } from "../../../domain/enums"

/**
 * GraphQL Input: Create User
 * Validates user creation data
 */
@InputType()
export class CreateUserInput {
    @Field(() => String)
    @IsString()
    @Transform(({ value }) => value?.trim())
        cognitoId: string

    @Field(() => String)
    @IsString()
    @Transform(({ value }) => value?.trim())
        fullName: string

    @Field(() => String)
    @IsEmail()
    @Transform(({ value }) => value?.toLowerCase().trim())
        email: string

    @Field(() => String)
    @IsString()
    @Transform(({ value }) => value?.trim())
        username: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        avatarUrl?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        phoneNumber?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        address?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        bio?: string

    @Field(() => Role, { defaultValue: Role.DONOR })
    @IsEnum(Role)
        role: Role
}
