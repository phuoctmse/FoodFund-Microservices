import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { IngredientRequest } from "./ingredient-request.model"
import { BaseSchema } from "../../shared"
import { ExpenseProofStatus } from "../enums"

@ObjectType("ExpenseProof")
@Directive("@key(fields: \"id\")")
export class ExpenseProof extends BaseSchema {
    @Field(() => String, {
        description: "Ingredient Request ID this proof belongs to",
    })
        requestId: string

    @Field(() => [String], {
        description: "Array of media URLs (bills, receipts, ingredient photos)",
    })
        media: string[]

    @Field(() => String, {
        description: "Total amount spent (in VND, as string to handle BigInt)",
    })
        amount: string

    @Field(() => ExpenseProofStatus, {
        description: "Current approval status",
    })
        status: ExpenseProofStatus

    @Field(() => String, {
        nullable: true,
        description: "Admin note (required when rejected)",
    })
        adminNote?: string

    @Field(() => Date, {
        nullable: true,
        description: "Timestamp when status was last changed",
    })
        changedStatusAt?: Date

    @Field(() => IngredientRequest, {
        nullable: true,
        description:
            "Ingredient request this proof belongs to (resolved from operation service)",
    })
        request?: IngredientRequest

    constructor() {
        super()
        this.media = []
    }
}
