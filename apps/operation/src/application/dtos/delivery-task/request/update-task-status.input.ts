import { DeliveryTaskStatus } from "@app/operation/src/domain"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator"

@InputType()
export class UpdateDeliveryTaskStatusInput {
    @Field(() => String, {
        description: "Delivery task ID",
    })
    @IsNotEmpty({ message: "Task ID is required" })
    @IsString()
        taskId: string

    @Field(() => DeliveryTaskStatus, {
        description: "New status",
    })
    @IsNotEmpty({ message: "Status is required" })
    @IsEnum(DeliveryTaskStatus, {
        message: "Status must be a valid DeliveryTaskStatus",
    })
        status: DeliveryTaskStatus

    @Field(() => String, {
        nullable: true,
        description: "Note for status change (required when FAILED or REJECTED)",
    })
    @ValidateIf(
        (o) =>
            o.status === DeliveryTaskStatus.FAILED ||
            o.status === DeliveryTaskStatus.REJECTED,
    )
    @IsNotEmpty({
        message: "Note is required when marking task as FAILED or REJECTED",
    })
    @IsString()
    @MaxLength(1000, { message: "Note must not exceed 1000 characters" })
        note?: string
}