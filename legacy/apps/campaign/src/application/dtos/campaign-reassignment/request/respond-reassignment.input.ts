import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsNotEmpty, IsString, IsUUID } from "class-validator"

@InputType()
export class RespondReassignmentInput {
    @Field(() => String, { description: "Reassignment request ID" })
    @IsNotEmpty()
    @IsUUID()
        reassignmentId: string

    @Field(() => Boolean, { description: "Accept (true) or Reject (false)" })
    @IsBoolean()
        accept: boolean

    @Field(() => String, { nullable: true, description: "Response note" })
    @IsString()
        note?: string
}