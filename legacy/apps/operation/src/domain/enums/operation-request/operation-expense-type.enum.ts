import { registerEnumType } from "@nestjs/graphql"

export enum OperationExpenseType {
    COOKING = "COOKING",
    DELIVERY = "DELIVERY",
}

registerEnumType(OperationExpenseType, {
    name: "OperationExpenseType",
    description: "Type of operation expense (COOKING or DELIVERY)",
})