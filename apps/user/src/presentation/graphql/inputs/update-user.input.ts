import { InputType, Field } from "@nestjs/graphql"
import { IsString, IsOptional } from "class-validator"
import { Transform } from "class-transformer"

/**
 * GraphQL Input: Update User
 * Validates user update data
 */
@InputType()
export class UpdateUserInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
        fullName?: string

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
}
