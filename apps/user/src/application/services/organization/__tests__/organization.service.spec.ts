import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { OrganizationService } from "../organization.service"
import {
    OrganizationRepository,
    UserRepository,
} from "@app/user/src/application/repositories"
import { AwsCognitoService } from "@libs/aws-cognito"
import { DataLoaderService } from "../../common"
import { Role } from "@libs/databases"
import { VerificationStatus } from "@libs/databases"
import { JoinOrganizationRole } from "../../../dtos"
import { PrismaClient } from "@app/user/src/generated/user-client"
import {
    OrganizationRequestNotFoundException,
    OrganizationRequestNotPendingException,
} from "@app/user/src/domain/exceptions/admin/admin.exceptions"

describe("OrganizationService", () => {
    let service: OrganizationService
    let organizationRepository: jest.Mocked<OrganizationRepository>
    let userRepository: jest.Mocked<UserRepository>
    let awsCognitoService: jest.Mocked<AwsCognitoService>
    let dataLoaderService: jest.Mocked<DataLoaderService>
    let prismaClient: jest.Mocked<any>

    const mockUser = {
        id: "user-123",
        cognito_id: "cognito-123",
        email: "test@example.com",
        user_name: "testuser",
        full_name: "Test User",
        role: Role.DONOR,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    } as any

    const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        representative_id: "user-123",
        status: VerificationStatus.VERIFIED,
        user: mockUser,
        Organization_Member: [],
        created_at: new Date(),
        updated_at: new Date(),
    } as any

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationService,
                {
                    provide: OrganizationRepository,
                    useValue: {
                        createOrganization: jest.fn(),
                        findPendingOrganizations: jest.fn(),
                        findAllOrganizations: jest.fn(),
                        findOrganizationById: jest.fn(),
                        findOrganizationByRepresentativeId: jest.fn(),
                        updateOrganizationStatus: jest.fn(),
                        createJoinRequest: jest.fn(),
                        findJoinRequestById: jest.fn(),
                        findJoinRequestsByOrganizationWithPagination: jest.fn(),
                        updateJoinRequestStatus: jest.fn(),
                        findMyJoinRequests: jest.fn(),
                        findPendingJoinRequest: jest.fn(),
                        deleteJoinRequest: jest.fn(),
                        checkExistingJoinRequestInAnyOrganization: jest.fn(),
                        findActiveOrganizationsWithMembersPaginated: jest.fn(),
                        findOrganizationWithMembers: jest.fn(),
                        findVerifiedMembershipByUserId: jest.fn(),
                    },
                },
                {
                    provide: UserRepository,
                    useValue: {
                        findUserById: jest.fn(),
                        findUserByCognitoId: jest.fn(),
                        findUserOrganization: jest.fn(),
                        findUserOrganizations: jest.fn(),
                    },
                },
                {
                    provide: AwsCognitoService,
                    useValue: {
                        updateUserAttributes: jest.fn(),
                    },
                },
                {
                    provide: DataLoaderService,
                    useValue: {
                        getUserOrganization: jest.fn(),
                    },
                },
                {
                    provide: PrismaClient,
                    useValue: {
                        $transaction: jest.fn(),
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
                    },
                },
            ],
        }).compile()

        service = module.get<OrganizationService>(OrganizationService)
        organizationRepository = module.get(OrganizationRepository)
        userRepository = module.get(UserRepository)
        awsCognitoService = module.get(AwsCognitoService)
        dataLoaderService = module.get(DataLoaderService)
        prismaClient = module.get(PrismaClient)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("requestCreateOrganization", () => {
        const createOrgInput = {
            name: "New Organization",
            description: "Test description",
            address: "123 Test St",
            phone_number: "0123456789",
            activity_field: "Non-profit",
            representative_name: "Test Representative",
            representative_identity_number: "123456789",
            email: "org@example.com",
        }

        it("should create organization request successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            userRepository.findUserOrganization.mockResolvedValue(null)
            organizationRepository.createOrganization.mockResolvedValue(
                mockOrganization,
            )

            const result = await service.requestCreateOrganization(
                "cognito-123",
                createOrgInput,
            )

            expect(result).toEqual(mockOrganization)
            expect(
                organizationRepository.createOrganization,
            ).toHaveBeenCalledWith("user-123", createOrgInput)
        })

        it("should throw error if user not found", async () => {
            userRepository.findUserById.mockResolvedValue(null)

            await expect(
                service.requestCreateOrganization(
                    "cognito-123",
                    createOrgInput,
                ),
            ).rejects.toThrow()
        })

        it("should throw error if user is not a DONOR", async () => {
            userRepository.findUserById.mockResolvedValue({
                ...mockUser,
                role: Role.FUNDRAISER,
            })

            await expect(
                service.requestCreateOrganization(
                    "cognito-123",
                    createOrgInput,
                ),
            ).rejects.toThrow()
        })

        it("should throw error if user has pending organization request", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            userRepository.findUserOrganization.mockResolvedValue({
                ...mockOrganization,
                status: VerificationStatus.PENDING,
            })

            await expect(
                service.requestCreateOrganization(
                    "cognito-123",
                    createOrgInput,
                ),
            ).rejects.toThrow()
        })
    })

    describe("approveOrganizationRequest", () => {
        it("should approve organization request successfully", async () => {
            const pendingOrg = {
                ...mockOrganization,
                status: VerificationStatus.PENDING,
            }

            organizationRepository.findOrganizationById.mockResolvedValue(
                pendingOrg,
            )
            prismaClient.$transaction.mockImplementation(async (callback) =>
                callback(prismaClient),
            )
            awsCognitoService.updateUserAttributes.mockResolvedValue({} as any)

            const result = await service.approveOrganizationRequest("org-123")

            expect(prismaClient.$transaction).toHaveBeenCalled()
            expect(awsCognitoService.updateUserAttributes).toHaveBeenCalledWith(
                "cognito-123",
                { "custom:role": Role.FUNDRAISER },
            )
        })

        it("should throw error if organization not found", async () => {
            organizationRepository.findOrganizationById.mockResolvedValue(null)

            await expect(
                service.approveOrganizationRequest("org-123"),
            ).rejects.toThrow(OrganizationRequestNotFoundException)
        })

        it("should throw error if organization not pending", async () => {
            organizationRepository.findOrganizationById.mockResolvedValue(
                mockOrganization,
            )

            await expect(
                service.approveOrganizationRequest("org-123"),
            ).rejects.toThrow(OrganizationRequestNotPendingException)
        })
    })

    describe("requestJoinOrganization", () => {
        const joinInput = {
            organization_id: "org-123",
            requested_role: JoinOrganizationRole.KITCHEN_STAFF,
        }

        it("should create join request successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            organizationRepository.findOrganizationById.mockResolvedValue(
                mockOrganization,
            )
            organizationRepository.checkExistingJoinRequestInAnyOrganization.mockResolvedValue(
                null,
            )
            organizationRepository.createJoinRequest.mockResolvedValue({
                id: "join-123",
            } as any)

            const result = await service.requestJoinOrganization(
                "cognito-123",
                joinInput,
            )

            expect(result).toBeDefined()
            expect(
                organizationRepository.createJoinRequest,
            ).toHaveBeenCalledWith("user-123", "org-123", Role.KITCHEN_STAFF)
        })

        it("should throw error if user not a DONOR", async () => {
            userRepository.findUserById.mockResolvedValue({
                ...mockUser,
                role: Role.FUNDRAISER,
            })

            await expect(
                service.requestJoinOrganization("cognito-123", joinInput),
            ).rejects.toThrow()
        })

        it("should throw error if organization not verified", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            organizationRepository.findOrganizationById.mockResolvedValue({
                ...mockOrganization,
                status: VerificationStatus.PENDING,
            })

            await expect(
                service.requestJoinOrganization("cognito-123", joinInput),
            ).rejects.toThrow(BadRequestException)
        })

        it("should throw error if user has existing join request", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            organizationRepository.findOrganizationById.mockResolvedValue(
                mockOrganization,
            )
            organizationRepository.checkExistingJoinRequestInAnyOrganization.mockResolvedValue(
                { id: "existing-123" } as any,
            )

            await expect(
                service.requestJoinOrganization("cognito-123", joinInput),
            ).rejects.toThrow(BadRequestException)
        })
    })

    describe("approveJoinRequest", () => {
        const mockJoinRequest = {
            id: "join-123",
            member_id: "user-456",
            organization_id: "org-123",
            member_role: Role.KITCHEN_STAFF,
            status: VerificationStatus.PENDING,
            member: {
                id: "user-456",
                cognito_id: "cognito-456",
                full_name: "Staff Member",
            },
            organization: {
                id: "org-123",
                representative_id: "user-123",
            },
        } as any

        it("should approve join request successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)
            organizationRepository.findJoinRequestById.mockResolvedValue(
                mockJoinRequest,
            )
            prismaClient.$transaction.mockImplementation(async (callback) =>
                callback(prismaClient),
            )
            awsCognitoService.updateUserAttributes.mockResolvedValue({} as any)

            const result = await service.approveJoinRequest(
                "join-123",
                "cognito-123",
            )

            expect(prismaClient.$transaction).toHaveBeenCalled()
            expect(awsCognitoService.updateUserAttributes).toHaveBeenCalled()
        })

        it("should throw error if not authorized", async () => {
            userRepository.findUserById.mockResolvedValue({
                ...mockUser,
                id: "different-user",
            })
            organizationRepository.findJoinRequestById.mockResolvedValue(
                mockJoinRequest,
            )

            await expect(
                service.approveJoinRequest("join-123", "cognito-123"),
            ).rejects.toThrow(BadRequestException)
        })
    })

    describe("getFundraiserOrganization", () => {
        it("should get fundraiser organization successfully", async () => {
            const fundraiserUser = { ...mockUser, role: Role.FUNDRAISER }
            userRepository.findUserById.mockResolvedValue(fundraiserUser)
            organizationRepository.findOrganizationByRepresentativeId.mockResolvedValue(
                mockOrganization,
            )

            const result =
                await service.getFundraiserOrganization("cognito-123")

            expect(result).toBeDefined()
            expect(result.representative).toEqual(mockUser)
        })

        it("should throw error if user not a fundraiser", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            await expect(
                service.getFundraiserOrganization("cognito-123"),
            ).rejects.toThrow()
        })

        it("should throw error if no organization found", async () => {
            const fundraiserUser = { ...mockUser, role: Role.FUNDRAISER }
            userRepository.findUserById.mockResolvedValue(fundraiserUser)
            organizationRepository.findOrganizationByRepresentativeId.mockResolvedValue(
                null,
            )

            await expect(
                service.getFundraiserOrganization("cognito-123"),
            ).rejects.toThrow(NotFoundException)
        })
    })

    describe("cancelJoinRequest", () => {
        const mockPendingRequest = {
            id: "join-123",
            status: VerificationStatus.PENDING,
            organization: {
                name: "Test Org",
            },
        } as any

        it("should cancel join request successfully", async () => {
            userRepository.findUserByCognitoId.mockResolvedValue(mockUser)
            organizationRepository.findPendingJoinRequest.mockResolvedValue(
                mockPendingRequest,
            )
            organizationRepository.deleteJoinRequest.mockResolvedValue(
                {} as any,
            )

            const result = await service.cancelJoinRequest("cognito-123")

            expect(result.success).toBe(true)
            expect(
                organizationRepository.deleteJoinRequest,
            ).toHaveBeenCalledWith("join-123")
        })

        it("should throw error if no pending request found", async () => {
            userRepository.findUserByCognitoId.mockResolvedValue(mockUser)
            organizationRepository.findPendingJoinRequest.mockResolvedValue(
                null,
            )

            await expect(
                service.cancelJoinRequest("cognito-123"),
            ).rejects.toThrow()
        })
    })

    describe("getActiveOrganizationsWithMembers", () => {
        it("should get paginated organizations successfully", async () => {
            const mockResult = {
                organizations: [mockOrganization],
                total: 1,
            }

            organizationRepository.findActiveOrganizationsWithMembersPaginated.mockResolvedValue(
                mockResult,
            )

            const result = await service.getActiveOrganizationsWithMembers({
                offset: 0,
                limit: 10,
            })

            expect(result.organizations).toHaveLength(1)
            expect(result.total).toBe(1)
        })
    })

    describe("leaveOrganization", () => {
        const mockStaffUser = {
            ...mockUser,
            role: Role.KITCHEN_STAFF,
        }

        const mockMemberRecord = {
            id: "member-123",
            organization: mockOrganization,
        } as any

        it("should allow staff member to leave organization", async () => {
            userRepository.findUserById.mockResolvedValue(mockStaffUser)
            organizationRepository.findVerifiedMembershipByUserId.mockResolvedValue(
                mockMemberRecord,
            )
            prismaClient.$transaction.mockImplementation(async (callback) =>
                callback(prismaClient),
            )
            awsCognitoService.updateUserAttributes.mockResolvedValue({} as any)

            const result = await service.leaveOrganization("cognito-123")

            expect(result.success).toBe(true)
            expect(result.previousRole).toBe(Role.KITCHEN_STAFF)
            expect(prismaClient.$transaction).toHaveBeenCalled()
        })

        it("should throw error if user is not staff", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            await expect(
                service.leaveOrganization("cognito-123"),
            ).rejects.toThrow(BadRequestException)
        })

        it("should throw error if user not a member", async () => {
            userRepository.findUserById.mockResolvedValue(mockStaffUser)
            organizationRepository.findVerifiedMembershipByUserId.mockResolvedValue(
                null,
            )

            await expect(
                service.leaveOrganization("cognito-123"),
            ).rejects.toThrow(NotFoundException)
        })
    })
})
