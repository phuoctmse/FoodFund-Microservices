import { registerEnumType } from "@nestjs/graphql"

export enum Role {
    DONOR = "DONOR",
    FUNDRAISER = "FUNDRAISER",
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF",
    ADMIN = "ADMIN",
}

export enum VerificationStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
}

export enum AvailabilityStatus {
    AVAILABLE = "AVAILABLE",
    UNAVAILABLE = "UNAVAILABLE",
}

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
