import { registerEnumType } from "@nestjs/graphql"

export enum JoinOrganizationRole {
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF"
}

// Register enum với GraphQL
registerEnumType(JoinOrganizationRole, {
    name: "JoinOrganizationRole",
    description: "Available roles for joining organization"
})