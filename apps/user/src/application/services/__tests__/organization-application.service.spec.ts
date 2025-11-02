import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { AwsCognitoService } from "@libs/aws-cognito"
import { OrganizationApplicationService } from "../organization-application.service"
import {
    IOrganizationRepository,
    IUserRepository,
} from "../../../domain/interfaces"
import { Role, VerificationStatus } from "../../../domain/enums"
import {
    UserNotFoundException,
    OrganizationNotFoundException,
} from "../../../domain/exceptions"
import { User } from "../../../domain/entities"
import { PrismaClient } from "../../../generated/user-client"

describe("OrganizationApplicationService", () => {
    let service: OrganizationApplicationService
    let mockOrganizationRepository: jest.Mocked<IOrganizationRepository>
    let mockUserRepository: jest.Mocked<IUserRepository>
    let mockAwsCognitoService: any
    let mockPrismaClient: any

    // Helper to create mock User
    const createMockUser = (overrides?: Partial<User>): User => {
        return new User(
            overrides?.id || "user-1",
            overrides?.cognitoId || "cognito-1",
            overrides?.email || "test@example.com",
            overrides?.username || "testuser",
            overrides?.fullName || "Test User",
            overrides?.isActive !== undefined ? overrides.isActive : true,
            overrides?.role || Role.DONOR,
            overrides?.avatarUrl,
            overrides?.phoneNumber,
            overrides?.bio,
            overrides?.address,
            overrides?.createdAt,
            overrides?.updatedAt,
        )
    }

    beforeEach(async () => {
        mockOrganizationRepository = {
            createOrganization: jest.fn(),
            findOrganizationById: jest.fn(),
            findOrganizationByRepresentativeId: jest.fn(),
            findOrganizationWithMembers: jest.fn(),
            updateOrganizationStatus: jest.fn(),
            findPendingOrganizations: jest.fn(),
            findAllOrganizations: jest.fn(),
            findActiveOrganizationsWithMembersPaginated: jest.fn(),
            createJoinRequest: jest.fn(),
            findJoinRequestById: jest.fn(),
            findJoinRequestsByOrganizationWithPagination: jest.fn(),
            findMyJoinRequests: jest.fn(),
            findPendingJoinRequest: jest.fn(),
            findVerifiedMembershipByUserId: jest.fn(),
            updateJoinRequestStatus: jest.fn(),
            deleteJoinRequest: jest.fn(),
            checkExistingJoinRequestInAnyOrganization: jest.fn(),
        } as any

        mockUserRepository = {
            findByCognitoId: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
        } as any

        mockAwsCognitoService = {
            updateUserAttributes: jest.fn(),
        }

        mockPrismaClient = {
            $transaction: jest.fn((callback) => callback(mockPrismaClient)),
            organization: {
                update: jest.fn(),
            },
            user: {
                update: jest.fn(),
            },
            organization_Member: {
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationApplicationService,
                {
                    provide: "IOrganizationRepository",
                    useValue: mockOrganizationRepository,
                },
                {
                    provide: "IUserRepository",
                    useValue: mockUserRepository,
                },
                {
                    provide: AwsCognitoService,
                    useValue: mockAwsCognitoService,
                },
                {
                    provide: PrismaClient,
                    useValue: mockPrismaClient,
                },
            ],
        }).compile()

        service = module.get<OrganizationApplicationService>(
            OrganizationApplicationService,
        )
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("requestCreateOrganization", () => {
        const mockOrgData = {
            name: "Test Org",
            activity_field: "Charity",
            address: "123 Test St",
            description: "Test Description",
            representative_name: "John Doe",
            representative_identity_number: "123456",
            email: "org@test.com",
            phone_number: "0123456789",
        }

        it("should create organization request successfully", async () => {
            const mockUser = createMockUser({ role: Role.DONOR })
            mockUserRepository.findByCognitoId.mockResolvedValue(mockUser)
            mockOrganizationRepository.findOrganizationByRepresentativeId.mockResolvedValue(
                null,
            )
            mockOrganizationRepository.createOrganization.mockResolvedValue({
                id: "org-1",
                ...mockOrgData,
                status: VerificationStatus.PENDING,
            })

            const result = await service.requestCreateOrganization(
                "cognito-1",
                mockOrgData,
            )

            expect(mockUserRepository.findByCognitoId).toHaveBeenCalledWith(
                "cognito-1",
            )
            expect(result.status).toBe(VerificationStatus.PENDING)
        })

        it("should throw error if user not found", async () => {
            mockUserRepository.findByCognitoId.mockResolvedValue(null)

            await expect(
                service.requestCreateOrganization("cognito-1", mockOrgData),
            ).rejects.toThrow(UserNotFoundException)
        })

        it("should throw error if user is not DONOR", async () => {
            const mockUser = createMockUser({ role: Role.FUNDRAISER })
            mockUserRepository.findByCognitoId.mockResolvedValue(mockUser)

            await expect(
                service.requestCreateOrganization("cognito-1", mockOrgData),
            ).rejects.toThrow(BadRequestException)
        })
    })

    describe("approveOrganizationRequest", () => {
        const mockOrganization = {
            id: "org-1",
            name: "Test Org",
            status: VerificationStatus.PENDING,
            representative_id: "user-1",
            user: {
                id: "user-1",
                cognitoId: "cognito-1",
            },
        }

        it("should approve organization successfully", async () => {
            mockOrganizationRepository.findOrganizationById.mockResolvedValue(
                mockOrganization,
            )
            mockPrismaClient.organization.update.mockResolvedValue({
                ...mockOrganization,
                status: VerificationStatus.VERIFIED,
            })
            mockAwsCognitoService.updateUserAttributes.mockResolvedValue(
                undefined,
            )

            const result = await service.approveOrganizationRequest("org-1")

            expect(mockPrismaClient.$transaction).toHaveBeenCalled()
            expect(
                mockAwsCognitoService.updateUserAttributes,
            ).toHaveBeenCalledWith("cognito-1", {
                "custom:role": Role.FUNDRAISER,
            })
        })

        it("should throw error if organization not found", async () => {
            mockOrganizationRepository.findOrganizationById.mockResolvedValue(
                null,
            )

            await expect(
                service.approveOrganizationRequest("org-1"),
            ).rejects.toThrow(OrganizationNotFoundException)
        })
    })

    describe("requestJoinOrganization", () => {
        const mockJoinData = {
            organization_id: "org-1",
            requested_role: "KITCHEN_STAFF",
        }

        it("should create join request successfully", async () => {
            const mockUser = createMockUser({ role: Role.DONOR })
            const mockOrganization = {
                id: "org-1",
                name: "Test Org",
                status: VerificationStatus.VERIFIED,
            }

            mockUserRepository.findByCognitoId.mockResolvedValue(mockUser)
            mockOrganizationRepository.findOrganizationById.mockResolvedValue(
                mockOrganization,
            )
            mockOrganizationRepository.checkExistingJoinRequestInAnyOrganization.mockResolvedValue(
                null,
            )
            mockOrganizationRepository.createJoinRequest.mockResolvedValue({
                id: "join-1",
                member_id: "user-1",
                organization_id: "org-1",
                member_role: Role.KITCHEN_STAFF,
                status: VerificationStatus.PENDING,
            })

            const result = await service.requestJoinOrganization(
                "cognito-1",
                mockJoinData,
            )

            expect(result.status).toBe(VerificationStatus.PENDING)
        })

        it("should throw error if user not found", async () => {
            mockUserRepository.findByCognitoId.mockResolvedValue(null)

            await expect(
                service.requestJoinOrganization("cognito-1", mockJoinData),
            ).rejects.toThrow(UserNotFoundException)
        })
    })

    describe("leaveOrganization", () => {
        const mockMemberRecord = {
            id: "member-1",
            member_id: "user-1",
            organization: {
                id: "org-1",
                name: "Test Org",
            },
        }

        it("should allow staff to leave organization", async () => {
            const mockUser = createMockUser({ role: Role.KITCHEN_STAFF })
            mockUserRepository.findByCognitoId.mockResolvedValue(mockUser)
            mockOrganizationRepository.findVerifiedMembershipByUserId.mockResolvedValue(
                mockMemberRecord,
            )
            mockAwsCognitoService.updateUserAttributes.mockResolvedValue(
                undefined,
            )

            const result = await service.leaveOrganization("cognito-1")

            expect(mockPrismaClient.$transaction).toHaveBeenCalled()
            expect(result.success).toBe(true)
        })

        it("should throw error if user is not staff", async () => {
            const mockUser = createMockUser({ role: Role.DONOR })
            mockUserRepository.findByCognitoId.mockResolvedValue(mockUser)

            await expect(
                service.leaveOrganization("cognito-1"),
            ).rejects.toThrow(BadRequestException)
        })
    })

    describe("getActiveOrganizationsWithMembers", () => {
        it("should return paginated organizations", async () => {
            const mockOrganizations = [
                {
                    id: "org-1",
                    name: "Org 1",
                    Organization_Member: [],
                    user: { id: "user-1" },
                },
            ]

            mockOrganizationRepository.findActiveOrganizationsWithMembersPaginated.mockResolvedValue(
                {
                    organizations: mockOrganizations,
                    total: 1,
                },
            )

            const result = await service.getActiveOrganizationsWithMembers({
                offset: 0,
                limit: 10,
            })

            expect(result.organizations).toHaveLength(1)
            expect(result.total).toBe(1)
        })
    })
})
