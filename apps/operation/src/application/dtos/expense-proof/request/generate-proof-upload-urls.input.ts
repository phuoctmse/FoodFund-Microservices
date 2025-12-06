import { Field, InputType, Int } from "@nestjs/graphql"
import {
    IsNotEmpty,
    IsString,
    IsInt,
    Min,
    Max,
    IsArray,
    ArrayMinSize,
    ArrayMaxSize,
} from "class-validator"

@InputType()
export class GenerateExpenseProofUploadUrlsInput {
    @Field(() => String, {
        description: "Ingredient Request ID for this expense proof",
    })
    @IsNotEmpty({ message: "Request ID is required" })
    @IsString()
        requestId: string

    @Field(() => Int, {
        description: "Number of files to upload (1-10)",
    })
    @IsInt({ message: "File count must be an integer" })
    @Min(1, { message: "Must upload at least 1 file" })
    @Max(10, { message: "Cannot upload more than 10 files at once" })
        fileCount: number

    @Field(() => [String], {
        description: "File types for each file (e.g., [\"jpg\", \"png\", \"mp4\"])",
    })
    @IsArray({ message: "File types must be an array" })
    @ArrayMinSize(1, { message: "At least 1 file type is required" })
    @ArrayMaxSize(10, { message: "Cannot specify more than 10 file types" })
    @IsString({ each: true, message: "Each file type must be a string" })
        fileTypes: string[]
}
