import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID } from "class-validator"
import { PostSortOrder } from "../../enum"

@InputType()
export class PostFilterInput {
    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID",
    })
    @IsOptional()
    @IsUUID()
        campaignId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by creator user ID",
    })
    @IsOptional()
    @IsUUID()
        creatorId?: string
}

@InputType()
export class PostPaginationInput {
    @Field(() => PostSortOrder, {
        nullable: true,
        defaultValue: PostSortOrder.NEWEST_FIRST,
        description: "Sort order",
    })
    @IsOptional()
        sortBy?: PostSortOrder

    @Field(() => Number, {
        nullable: true,
        defaultValue: 10,
        description: "Number of items per page",
    })
    @IsOptional()
        limit?: number

    @Field(() => Number, {
        nullable: true,
        defaultValue: 0,
        description: "Offset for pagination",
    })
    @IsOptional()
        offset?: number
}
