import { registerEnumType } from "@nestjs/graphql"

export enum JoinOrganizationRole {
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF",
}

registerEnumType(JoinOrganizationRole, {
    name: "JoinOrganizationRole",
    description: "Available roles for joining organization",
})
