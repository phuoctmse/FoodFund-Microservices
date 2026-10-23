import { OperationRequestStatus } from "@app/operation/src/domain"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from "class-validator"

@InputType()
export class UpdateOperationRequestStatusInput {
    @Field(() => String, {
        description: "Operation request ID",
    })
    @IsNotEmpty({ message: "Request ID is required" })
    @IsString()
        requestId: string

    @Field(() => OperationRequestStatus, {
        description: "New status (PENDING, APPROVED, or REJECTED)",
    })
    @IsNotEmpty({ message: "Status is required" })
    @IsEnum(OperationRequestStatus, {
        message: "Status must be PENDING, APPROVED, or REJECTED",
    })
        status: OperationRequestStatus

    @Field(() => String, {
        nullable: true,
        description: "Admin note (required when status is REJECTED)",
    })
    @ValidateIf((o) => o.status === OperationRequestStatus.REJECTED)
    @IsNotEmpty({
        message: "Admin note is required when rejecting a request",
    })
    @IsString()
        adminNote?: string
}