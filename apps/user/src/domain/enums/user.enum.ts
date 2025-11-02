/**
 * Domain Enums
 * Pure enums without framework dependencies
 */

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
