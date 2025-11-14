import { Field, InputType, registerEnumType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator"

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
            description: "Fundraiser has not received the money or encountered issues",
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

    @Field(() => String, {
        nullable: true,
        description: "Reason for failure (required if status is FAILED)",
    })
    @IsOptional()
    @IsString()
    @ValidateIf((o) => o.status === DisbursementConfirmationStatus.FAILED)
    @IsNotEmpty({ message: "Reason is required when status is FAILED" })
        reason?: string
}
