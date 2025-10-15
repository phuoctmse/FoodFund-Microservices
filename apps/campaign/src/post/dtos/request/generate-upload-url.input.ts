import { Field, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from "class-validator"

@InputType()
export class GeneratePostMediaUploadUrlsInput {
    @Field(() => String, {
        nullable: true,
        description: "Optional post ID if updating existing post",
    })
    @IsOptional()
    @IsUUID(4, { message: "Post ID must be a valid UUID v4" })
        postId?: string

    @Field(() => Int, {
        description: "Number of files to upload (1-10)",
        defaultValue: 1,
    })
    @IsNotEmpty({ message: "File count is required" })
    @IsInt({ message: "File count must be an integer" })
    @Min(1, { message: "Minimum 1 file per request" })
    @Max(10, { message: "Maximum 10 files per request" })
        fileCount: number

    @Field(() => [String], {
        nullable: true,
        description:
            "File types for each upload (jpg, jpeg, png, webp, gif, mp4, webm, mov)",
    })
    @IsOptional()
    @IsArray({ message: "File types must be an array" })
    @ArrayMaxSize(10, { message: "Maximum 10 file types" })
    @IsString({ each: true, message: "Each file type must be a string" })
        fileTypes?: string[]
}
