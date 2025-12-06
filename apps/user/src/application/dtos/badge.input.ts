import { Field, InputType, Int } from "@nestjs/graphql"
import { IsString, IsOptional, IsBoolean, IsInt, Min } from "class-validator"

@InputType()
export class CreateBadgeInput {
        @Field()
        @IsString()
            name: string

        @Field()
        @IsString()
            description: string

        @Field()
        @IsString()
            icon_url: string

        @Field(() => Int, { nullable: true })
        @IsOptional()
        @IsInt()
        @Min(0)
            sort_order?: number

        @Field()
        @IsBoolean()
            is_active: boolean
}

@InputType()
export class UpdateBadgeInput {
        @Field()
        @IsString()
            name: string

        @Field()
        @IsString()
            description: string

        @Field()
        @IsString()
            icon_url: string

        @Field(() => Int)
        @IsInt()
        @Min(0)
            sort_order: number

        @Field()
        @IsBoolean()
            is_active: boolean
}

@InputType()
export class AwardBadgeInput {
        @Field()
        @IsString()
            userId: string

        @Field()
        @IsString()
            badgeId: string
}
