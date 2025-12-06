import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsOptional, IsIn } from "class-validator"

@InputType()
export class GenerateAvatarUploadUrlInput {
    @Field({ nullable: true, description: "File type (jpg, png, webp)" })
    @IsOptional()
    @IsString()
    @IsIn(["jpg", "jpeg", "png", "webp"])
        fileType?: string
}
