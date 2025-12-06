import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsString } from "class-validator"

@InputType()
export class GenerateProofUploadUrlInput {
    @Field(() => String, {
        description: "Campaign phase ID for organizing the proof files",
    })
    @IsNotEmpty()
    @IsString()
        campaignPhaseId: string

    @Field(() => String, {
        description: "File type/extension (e.g., 'jpg', 'png', 'pdf')",
        defaultValue: "jpg",
    })
    @IsString()
        fileType?: string
}
