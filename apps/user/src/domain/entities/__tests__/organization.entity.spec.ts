import { Organization } from "../organization.entity"
import { VerificationStatus } from "../../enums"

describe("Organization Entity", () => {
    const mockOrganization = new Organization(
        "org-1",
        "Test Organization",
        "Test Description",
        "123 Test St",
        "0123456789",
        "https://test.org",
        VerificationStatus.PENDING,
        "user-1",
        new Date("2024-01-01"),
        new Date("2024-01-01"),
    )

    describe("canAcceptMembers", () => {
        it("should return true when organization is verified", () => {
            const verifiedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.VERIFIED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(verifiedOrg.canAcceptMembers()).toBe(true)
        })

        it("should return false when organization is pending", () => {
            expect(mockOrganization.canAcceptMembers()).toBe(false)
        })

        it("should return false when organization is rejected", () => {
            const rejectedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.REJECTED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(rejectedOrg.canAcceptMembers()).toBe(false)
        })
    })

    describe("isPending", () => {
        it("should return true when status is PENDING", () => {
            expect(mockOrganization.isPending()).toBe(true)
        })

        it("should return false when status is not PENDING", () => {
            const verifiedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.VERIFIED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(verifiedOrg.isPending()).toBe(false)
        })
    })

    describe("isVerified", () => {
        it("should return true when status is VERIFIED", () => {
            const verifiedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.VERIFIED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(verifiedOrg.isVerified()).toBe(true)
        })

        it("should return false when status is not VERIFIED", () => {
            expect(mockOrganization.isVerified()).toBe(false)
        })
    })

    describe("approve", () => {
        it("should approve a pending organization", () => {
            const approved = mockOrganization.approve()

            expect(approved.status).toBe(VerificationStatus.VERIFIED)
            expect(approved.id).toBe(mockOrganization.id)
            expect(approved.name).toBe(mockOrganization.name)
        })

        it("should throw error when approving non-pending organization", () => {
            const verifiedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.VERIFIED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(() => verifiedOrg.approve()).toThrow(
                "Only pending organizations can be approved",
            )
        })
    })

    describe("reject", () => {
        it("should reject a pending organization", () => {
            const rejected = mockOrganization.reject()

            expect(rejected.status).toBe(VerificationStatus.REJECTED)
            expect(rejected.id).toBe(mockOrganization.id)
            expect(rejected.name).toBe(mockOrganization.name)
        })

        it("should throw error when rejecting non-pending organization", () => {
            const verifiedOrg = new Organization(
                "org-1",
                "Test Org",
                null,
                null,
                null,
                null,
                VerificationStatus.VERIFIED,
                "user-1",
                new Date(),
                new Date(),
            )

            expect(() => verifiedOrg.reject()).toThrow(
                "Only pending organizations can be rejected",
            )
        })
    })
})
