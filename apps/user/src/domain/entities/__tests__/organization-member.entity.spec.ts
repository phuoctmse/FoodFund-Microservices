import { OrganizationMember } from "../organization-member.entity"
import { Role, VerificationStatus } from "../../enums"

describe("OrganizationMember Entity", () => {
    const mockMember = new OrganizationMember(
        "member-1",
        "org-1",
        "user-1",
        Role.KITCHEN_STAFF,
        VerificationStatus.PENDING,
        new Date("2024-01-01"),
    )

    describe("isPending", () => {
        it("should return true when status is PENDING", () => {
            expect(mockMember.isPending()).toBe(true)
        })

        it("should return false when status is not PENDING", () => {
            const verifiedMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.KITCHEN_STAFF,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(verifiedMember.isPending()).toBe(false)
        })
    })

    describe("isVerified", () => {
        it("should return true when status is VERIFIED", () => {
            const verifiedMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.KITCHEN_STAFF,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(verifiedMember.isVerified()).toBe(true)
        })

        it("should return false when status is not VERIFIED", () => {
            expect(mockMember.isVerified()).toBe(false)
        })
    })

    describe("isStaff", () => {
        it("should return true for KITCHEN_STAFF", () => {
            expect(mockMember.isStaff()).toBe(true)
        })

        it("should return true for DELIVERY_STAFF", () => {
            const deliveryMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.DELIVERY_STAFF,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(deliveryMember.isStaff()).toBe(true)
        })

        it("should return false for FUNDRAISER", () => {
            const fundraiserMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.FUNDRAISER,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(fundraiserMember.isStaff()).toBe(false)
        })
    })

    describe("isFundraiser", () => {
        it("should return true for FUNDRAISER", () => {
            const fundraiserMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.FUNDRAISER,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(fundraiserMember.isFundraiser()).toBe(true)
        })

        it("should return false for non-FUNDRAISER", () => {
            expect(mockMember.isFundraiser()).toBe(false)
        })
    })

    describe("approve", () => {
        it("should approve a pending membership", () => {
            const approved = mockMember.approve()

            expect(approved.status).toBe(VerificationStatus.VERIFIED)
            expect(approved.id).toBe(mockMember.id)
            expect(approved.member_role).toBe(mockMember.member_role)
        })

        it("should throw error when approving non-pending membership", () => {
            const verifiedMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.KITCHEN_STAFF,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(() => verifiedMember.approve()).toThrow(
                "Only pending memberships can be approved",
            )
        })
    })

    describe("reject", () => {
        it("should reject a pending membership", () => {
            const rejected = mockMember.reject()

            expect(rejected.status).toBe(VerificationStatus.REJECTED)
            expect(rejected.id).toBe(mockMember.id)
            expect(rejected.member_role).toBe(mockMember.member_role)
        })

        it("should throw error when rejecting non-pending membership", () => {
            const verifiedMember = new OrganizationMember(
                "member-1",
                "org-1",
                "user-1",
                Role.KITCHEN_STAFF,
                VerificationStatus.VERIFIED,
                new Date(),
            )

            expect(() => verifiedMember.reject()).toThrow(
                "Only pending memberships can be rejected",
            )
        })
    })
})
