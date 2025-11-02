import { VerificationStatus } from "../enums"

/**
 * Domain Entity: Organization
 * Represents an organization in the system with business rules
 */
export class Organization {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly description: string | null,
        public readonly address: string | null,
        public readonly phone_number: string | null,
        public readonly website: string | null,
        public readonly status: VerificationStatus,
        public readonly representative_id: string,
        public readonly created_at: Date,
        public readonly updated_at: Date,
    ) {}

    /**
     * Business Rule: Check if organization can accept new members
     */
    canAcceptMembers(): boolean {
        return this.status === VerificationStatus.VERIFIED
    }

    /**
     * Business Rule: Check if organization is pending approval
     */
    isPending(): boolean {
        return this.status === VerificationStatus.PENDING
    }

    /**
     * Business Rule: Check if organization is verified
     */
    isVerified(): boolean {
        return this.status === VerificationStatus.VERIFIED
    }

    /**
     * Business Rule: Check if organization is rejected
     */
    isRejected(): boolean {
        return this.status === VerificationStatus.REJECTED
    }

    /**
     * Business Rule: Approve organization
     */
    approve(): Organization {
        if (!this.isPending()) {
            throw new Error("Only pending organizations can be approved")
        }

        return new Organization(
            this.id,
            this.name,
            this.description,
            this.address,
            this.phone_number,
            this.website,
            VerificationStatus.VERIFIED,
            this.representative_id,
            this.created_at,
            new Date(),
        )
    }

    /**
     * Business Rule: Reject organization
     */
    reject(): Organization {
        if (!this.isPending()) {
            throw new Error("Only pending organizations can be rejected")
        }

        return new Organization(
            this.id,
            this.name,
            this.description,
            this.address,
            this.phone_number,
            this.website,
            VerificationStatus.REJECTED,
            this.representative_id,
            this.created_at,
            new Date(),
        )
    }
}
