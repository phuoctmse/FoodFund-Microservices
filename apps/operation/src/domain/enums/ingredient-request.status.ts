import { registerEnumType } from "@nestjs/graphql"

export enum IngredientRequestStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    DISBURSED = "DISBURSED",
}

registerEnumType(IngredientRequestStatus, {
    name: "IngredientRequestStatus",
    description: "Status of ingredient purchase request",
    valuesMap: {
        PENDING: {
            description: "Submitted by kitchen staff, awaiting admin review",
        },
        APPROVED: {
            description: "Admin approved for procurement",
        },
        REJECTED: {
            description: "Admin rejected the request",
        },
        DISBURSED: {
            description: "Funds have been disbursed to kitchen staff",
        },
    },
})
