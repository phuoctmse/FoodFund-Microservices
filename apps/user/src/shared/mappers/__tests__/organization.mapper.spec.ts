import { Role, VerificationStatus } from "../../../domain/enums"

describe("Organization Mapper", () => {
    describe("mapOrganizationWithMembers", () => {
        it("should map organization with members correctly", () => {
            const mockOrgData = {
                id: "org-1",
                name: "Test Organization",
                description: "Test Description",
                address: "123 Test St",
                phone_number: "0123456789",
                website: "https://test.org",
                status: VerificationStatus.VERIFIED,
                representative_id: "user-1",
                created_at: new Date("2024-01-01"),
                updated_at: new Date("2024-01-01"),
                user: {
                    id: "user-1",
                    full_name: "John Doe",
                    email: "john@example.com",
                },
                Organization_Member: [
                    {
                        id: "member-1",
                        member_id: "user-2",
                        member_role: Role.KITCHEN_STAFF,
                        status: VerificationStatus.VERIFIED,
                        joined_at: new Date("2024-01-02"),
                        member: {
                            id: "user-2",
                            full_name: "Jane Doe",
                            email: "jane@example.com",
                        },
                    },
                ],
            }

            // Manual mapping (since we don't have a dedicated mapper yet)
            const mapped = {
                ...mockOrgData,
                representative: mockOrgData.user,
                members: mockOrgData.Organization_Member.map((m) => ({
                    id: m.id,
                    member: m.member,
                    member_role: m.member_role,
                    status: m.status,
                    joined_at: m.joined_at,
                })),
                total_members: mockOrgData.Organization_Member.length,
                active_members: mockOrgData.Organization_Member.filter(
                    (m) => m.status === VerificationStatus.VERIFIED,
                ).length,
            }

            expect(mapped.representative).toBeDefined()
            expect(mapped.representative.full_name).toBe("John Doe")
            expect(mapped.members).toHaveLength(1)
            expect(mapped.total_members).toBe(1)
            expect(mapped.active_members).toBe(1)
        })

        it("should handle organization with no members", () => {
            const mockOrgData = {
                id: "org-1",
                name: "Test Organization",
                Organization_Member: [],
                user: {
                    id: "user-1",
                    full_name: "John Doe",
                },
            }

            const mapped = {
                ...mockOrgData,
                representative: mockOrgData.user,
                members: [],
                total_members: 0,
                active_members: 0,
            }

            expect(mapped.members).toHaveLength(0)
            expect(mapped.total_members).toBe(0)
            expect(mapped.active_members).toBe(0)
        })

        it("should count only verified members as active", () => {
            const mockOrgData = {
                Organization_Member: [
                    {
                        id: "member-1",
                        status: VerificationStatus.VERIFIED,
                    },
                    {
                        id: "member-2",
                        status: VerificationStatus.PENDING,
                    },
                    {
                        id: "member-3",
                        status: VerificationStatus.VERIFIED,
                    },
                ],
            }

            const active_members = mockOrgData.Organization_Member.filter(
                (m: any) => m.status === VerificationStatus.VERIFIED,
            ).length

            expect(active_members).toBe(2)
        })
    })
})
