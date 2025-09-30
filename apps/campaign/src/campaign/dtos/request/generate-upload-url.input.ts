import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID } from "class-validator"

@InputType()
export class GenerateUploadUrlInput {
    @Field(() => String, {
        nullable: true,
        description: "Optional campaign ID if updating existing campaign",
    })
    @IsOptional()
    @IsUUID(4, { message: "Campaign ID must be a valid UUID" })
        campaignId?: string

    @Field(() => String, {
        nullable: true,
        description: "File type hint (jpeg, png, webp)",
    })
    @IsOptional()
    @IsString()
        fileType?: string
}
