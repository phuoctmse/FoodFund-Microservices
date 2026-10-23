import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsOptional, IsIn } from "class-validator"

@InputType()
export class GenerateBadgeUploadUrlInput {
        @Field({ nullable: true, description: "File type (jpg, png, svg, webp)" })
        @IsOptional()
        @IsString()
        @IsIn(["jpg", "jpeg", "png", "svg", "webp"])
            fileType?: string
}
