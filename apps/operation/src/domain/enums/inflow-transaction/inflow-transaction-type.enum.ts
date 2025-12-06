import { registerEnumType } from "@nestjs/graphql"

export enum InflowTransactionType {
    INGREDIENT = "INGREDIENT",
    COOKING = "COOKING",
    DELIVERY = "DELIVERY",
}

registerEnumType(InflowTransactionType, {
    name: "InflowTransactionType",
    description: "Type of inflow transaction (disbursement)",
    valuesMap: {
        INGREDIENT: {
            description: "Disbursement for ingredient requests",
        },
        COOKING: {
            description: "Disbursement for cooking operation requests",
        },
        DELIVERY: {
            description: "Disbursement for delivery operation requests",
        },
    },
})
