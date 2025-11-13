import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsOptional, IsString } from "class-validator"

@InputType()
export class CreateCampaignCategoryInput {
    @Field(() => String, { description: "Category title" })
    @IsString({ message: "Title must be a string" })
    @IsNotEmpty({ message: "Title is required and cannot be empty" })
        title: string

    @Field(() => String, { description: "Category description" })
    @IsString({ message: "Description must be a string" })
    @IsNotEmpty({ message: "Description is required and cannot be empty" })
        description: string
}

@InputType()
export class UpdateCampaignCategoryInput {
    @Field(() => String, { nullable: true, description: "Category title" })
    @IsOptional()
    @IsString({ message: "Title must be a string" })
    @IsNotEmpty({ message: "Title cannot be empty if provided" })
        title?: string

    @Field(() => String, {
        nullable: true,
        description: "Category description",
    })
    @IsOptional()
    @IsString({ message: "Description must be a string" })
    @IsNotEmpty({ message: "Description cannot be empty if provided" })
        description?: string
}
