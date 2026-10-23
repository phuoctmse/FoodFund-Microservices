import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsString, IsArray, ArrayMinSize } from "class-validator"

@InputType()
export class CreateExpenseProofInput {
    @Field(() => String, {
        description: "Ingredient Request ID that this proof belongs to",
    })
    @IsNotEmpty({ message: "Request ID is required" })
    @IsString()
        requestId: string

    @Field(() => [String], {
        description:
            "Array of media file keys from DigitalOcean Spaces (bills, receipts, ingredient photos)",
    })
    @IsArray({ message: "Media file keys must be an array" })
    @ArrayMinSize(1, { message: "At least 1 media file is required" })
    @IsString({ each: true, message: "Each media file key must be a string" })
        mediaFileKeys: string[]

    @Field(() => String, {
        description: "Total amount spent (in VND, as string to handle BigInt)",
    })
    @IsNotEmpty({ message: "Amount is required" })
    @IsString()
        amount: string
}
