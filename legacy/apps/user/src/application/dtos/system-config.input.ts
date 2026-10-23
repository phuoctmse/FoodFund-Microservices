import { Field, InputType } from "@nestjs/graphql"
import { IsString, IsOptional } from "class-validator"

@InputType()
export class UpdateSystemConfigInput {
    @Field()
    @IsString()
        key: string

    @Field()
    @IsString()
        value: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
        description?: string

    @Field({ nullable: true })
    @IsOptional()
    @IsString()
        dataType?: string
}
