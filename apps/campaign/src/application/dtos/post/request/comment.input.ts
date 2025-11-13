import { Field, InputType } from "@nestjs/graphql"
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
} from "class-validator"

@InputType()
export class CreateCommentInput {
    @Field(() => String, {
        description: "Post ID to comment on",
    })
    @IsUUID()
    @IsNotEmpty()
        postId: string

    @Field(() => String, {
        description: "Comment content",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { message: "Bình luận không được để trống" })
        content: string

    @Field(() => String, {
        nullable: true,
        description: "Parent comment ID for nested replies",
    })
    @IsOptional()
    @IsUUID()
        parentCommentId?: string
}

@InputType()
export class UpdateCommentInput {
    @Field(() => String, {
        description: "Updated comment content",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { message: "Bình luận không được để trống" })
        content: string
}
