import { Field, InputType, registerEnumType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsString } from "class-validator"

export enum DisbursementConfirmationStatus {
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

registerEnumType(DisbursementConfirmationStatus, {
    name: "DisbursementConfirmationStatus",
    description: "Status when fundraiser confirms disbursement receipt",
    valuesMap: {
        COMPLETED: {
            description: "Fundraiser has received the money",
        },
        FAILED: {
            description: "Fundraiser reports not receiving the money or encountering issues",
        },
    },
})

@InputType()
export class ConfirmDisbursementInput {
    @Field(() => String, {
        description: "Inflow Transaction ID",
    })
    @IsNotEmpty()
    @IsString()
        id: string

    @Field(() => DisbursementConfirmationStatus, {
        description: "Confirmation status (COMPLETED or FAILED)",
    })
    @IsNotEmpty()
    @IsEnum(DisbursementConfirmationStatus)
        status: DisbursementConfirmationStatus
}
