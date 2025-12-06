import { Field, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsString,
    Max,
    Min,
} from "class-validator"

@InputType()
export class GenerateMealBatchMediaUploadUrlsInput {
    @Field(() => String, {
        description: "Campaign phase ID for organizing uploads",
    })
    @IsNotEmpty({ message: "Campaign phase ID is required" })
    @IsString()
        campaignPhaseId: string

    @Field(() => Int, {
        description: "Number of media files to upload (max 5)",
    })
    @IsInt({ message: "File count must be an integer" })
    @Min(1, { message: "At least 1 file is required" })
    @Max(5, { message: "Maximum 5 files allowed" })
        fileCount: number

    @Field(() => [String], {
        description: "Array of file types (e.g., ['jpg', 'png', 'mp4'])",
    })
    @IsArray({ message: "File types must be an array" })
    @ArrayMinSize(1, { message: "At least 1 file type is required" })
    @ArrayMaxSize(5, { message: "Maximum 5 file types allowed" })
    @IsString({ each: true, message: "Each file type must be a string" })
        fileTypes: string[]
}
