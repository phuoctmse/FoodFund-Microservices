import { Field, InputType } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
} from "class-validator"

@InputType()
export class CreatePostInput {
    @Field(() => String, {
        description: "Campaign ID this post belongs to",
    })
    @IsUUID()
    @IsNotEmpty()
        campaignId: string

    @Field(() => String, {
        description: "Post title",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: "Tiêu đề phải có ít nhất 5 ký tự" })
    @MaxLength(255, { message: "Tiêu đề không được vượt quá 255 ký tự" })
        title: string

    @Field(() => String, {
        description: "Post content/body",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(10, { message: "Nội dung phải có ít nhất 10 ký tự" })
        content: string

    @Field(() => [String], {
        nullable: true,
        description:
            "Array of media file keys from generatePostMediaUploadUrls",
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10, { message: "Tối đa 10 media files mỗi bài viết" })
    @IsString({ each: true })
        mediaFileKeys?: string[]
}

@InputType()
export class UpdatePostInput {
    @Field(() => String, {
        nullable: true,
        description: "Updated title",
    })
    @IsOptional()
    @IsString()
    @MinLength(5, { message: "Tiêu đề phải có ít nhất 5 ký tự" })
    @MaxLength(255, { message: "Tiêu đề không được vượt quá 255 ký tự" })
        title?: string

    @Field(() => String, {
        nullable: true,
        description: "Updated content",
    })
    @IsOptional()
    @IsString()
    @MinLength(10, { message: "Nội dung phải có ít nhất 10 ký tự" })
        content?: string

    @Field(() => [String], {
        nullable: true,
        description: "Updated media file keys (replaces all existing media)",
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
        mediaFileKeys?: string[]
}
