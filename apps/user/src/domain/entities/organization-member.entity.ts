import { Role, VerificationStatus } from "../enums"

/**
 * Domain Entity: Organization Member
 * Represents a member's relationship with an organization
 */
export class OrganizationMember {
    constructor(
        public readonly id: string,
        public readonly organization_id: string,
        public readonly member_id: string,
        public readonly member_role: Role,
        public readonly status: VerificationStatus,
        public readonly joined_at: Date,
    ) {}

    /**
     * Business Rule: Check if membership is pending
     */
    isPending(): boolean {
        return this.status === VerificationStatus.PENDING
    }

    /**
     * Business Rule: Check if membership is verified
     */
    isVerified(): boolean {
        return this.status === VerificationStatus.VERIFIED
    }

    /**
     * Business Rule: Check if membership is rejected
     */
    isRejected(): boolean {
        return this.status === VerificationStatus.REJECTED
    }

    /**
     * Business Rule: Check if member is staff
     */
    isStaff(): boolean {
        return (
            this.member_role === Role.KITCHEN_STAFF ||
            this.member_role === Role.DELIVERY_STAFF
        )
    }

    /**
     * Business Rule: Check if member is fundraiser
     */
    isFundraiser(): boolean {
        return this.member_role === Role.FUNDRAISER
    }

    /**
     * Business Rule: Approve membership
     */
    approve(): OrganizationMember {
        if (!this.isPending()) {
            throw new Error("Only pending memberships can be approved")
        }

        return new OrganizationMember(
            this.id,
            this.organization_id,
            this.member_id,
            this.member_role,
            VerificationStatus.VERIFIED,
            this.joined_at,
        )
    }

    /**
     * Business Rule: Reject membership
     */
    reject(): OrganizationMember {
        if (!this.isPending()) {
            throw new Error("Only pending memberships can be rejected")
        }

        return new OrganizationMember(
            this.id,
            this.organization_id,
            this.member_id,
            this.member_role,
            VerificationStatus.REJECTED,
            this.joined_at,
        )
    }
}
