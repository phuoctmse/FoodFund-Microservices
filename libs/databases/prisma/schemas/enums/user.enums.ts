import { registerEnumType } from "@nestjs/graphql"

// User Role Enum
export enum Role {
    DONOR = "DONOR",
    FUNDRAISER = "FUNDRAISER",
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF",
    ADMIN = "ADMIN",
}

// Verification Status Enum
export enum VerificationStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
}

// Availability Status Enum
export enum AvailabilityStatus {
    AVAILABLE = "AVAILABLE",
    UNAVAILABLE = "UNAVAILABLE",
}

// Register GraphQL enums
registerEnumType(Role, {
    name: "Role",
    description: "User role in the system",
})

registerEnumType(VerificationStatus, {
    name: "VerificationStatus",
    description: "Verification status for fundraisers",
})

registerEnumType(AvailabilityStatus, {
    name: "AvailabilityStatus",
    description: "Availability status for delivery staff",
})
