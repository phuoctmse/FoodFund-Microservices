import { Field, InputType } from "@nestjs/graphql"
import { IsNotEmpty, IsNumber, IsString, ValidateIf } from "class-validator"

@InputType()
export class CreateInflowTransactionInput {
    @Field(() => String, {
        description: "Campaign phase ID for this disbursement",
    })
    @IsNotEmpty()
    @IsString()
        campaignPhaseId: string

    @Field(() => String, {
        description: "Ingredient request ID to link this disbursement to (required if operationRequestId is not provided)",
        nullable: true,
    })
    @ValidateIf((o) => !o.operationRequestId)
    @IsNotEmpty({ message: "Either ingredientRequestId or operationRequestId must be provided" })
    @IsString()
        ingredientRequestId?: string

    @Field(() => String, {
        description: "Operation request ID to link this disbursement to (required if ingredientRequestId is not provided)",
        nullable: true,
    })
    @ValidateIf((o) => !o.ingredientRequestId)
    @IsNotEmpty({ message: "Either ingredientRequestId or operationRequestId must be provided" })
    @IsString()
        operationRequestId?: string

    @Field(() => Number, {
        description: "Amount to disburse (in VND)",
    })
    @IsNotEmpty()
    @IsNumber()
        amount: bigint

    @Field(() => String, {
        description: "Proof CDN URL (use cdnUrl from generateProofUploadUrl mutation after uploading the file)",
    })
    @IsNotEmpty()
    @IsString()
        proof: string
}
