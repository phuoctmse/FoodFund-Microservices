import { registerEnumType } from "@nestjs/graphql"
import {
    Role,
    VerificationStatus,
    AvailabilityStatus,
} from "../../../domain/enums"

/**
 * Register Domain Enums with GraphQL
 * This allows GraphQL to recognize and use these enums in schema
 */

registerEnumType(Role, {
    name: "Role",
    description: "User role in the system",
    valuesMap: {
        DONOR: {
            description: "Donor - Can donate and create organizations",
        },
        FUNDRAISER: {
            description: "Fundraiser - Manages organization",
        },
        KITCHEN_STAFF: {
            description: "Kitchen Staff - Prepares food",
        },
        DELIVERY_STAFF: {
            description: "Delivery Staff - Delivers food",
        },
        ADMIN: {
            description: "Admin - System administrator",
        },
    },
})

registerEnumType(VerificationStatus, {
    name: "VerificationStatus",
    description: "Verification status for organizations and memberships",
    valuesMap: {
        PENDING: {
            description: "Pending approval",
        },
        VERIFIED: {
            description: "Verified and active",
        },
        REJECTED: {
            description: "Rejected",
        },
    },
})

registerEnumType(AvailabilityStatus, {
    name: "AvailabilityStatus",
    description: "Availability status",
    valuesMap: {
        AVAILABLE: {
            description: "Available",
        },
        UNAVAILABLE: {
            description: "Unavailable",
        },
    },
})

// Export enums for use in other files
export { Role, VerificationStatus, AvailabilityStatus }
