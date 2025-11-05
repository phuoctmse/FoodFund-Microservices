import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException } from "@nestjs/common"
import { UserAdminService } from "../user-admin.service"
import {
    UserAdminRepository,
    UserCommonRepository,
} from "../../../../domain/repositories"
import { AwsCognitoService } from "libs/aws-cognito"
import { Role } from "@libs/databases"

describe("UserAdminService", () => {
    let service: UserAdminService
    let userAdminRepository: jest.Mocked<UserAdminRepository>
    let userCommonRepository: jest.Mocked<UserCommonRepository>
    let awsCognitoService: jest.Mocked<AwsCognitoService>

    const mockAdmin = {
        id: "admin-123",
        cognito_id: "cognito-admin",
        email: "admin@example.com",
        user_name: "admin",
        full_name: "Admin User",
        phone_number: null,
        avatar_url: null,
        bio: null,
        address: null,
        role: Role.ADMIN,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    } as any

    const mockStaff = {
        id: "staff-123",
        cognito_id: "cognito-staff",
        email: "staff@example.com",
        user_name: "staff",
        full_name: "Staff User",
        phone_number: null,
        avatar_url: null,
        bio: null,
        address: null,
        role: Role.KITCHEN_STAFF,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    } as any

    const mockDonor = {
        id: "donor-123",
        cognito_id: "cognito-donor",
        email: "donor@example.com",
        user_name: "donor",
        full_name: "Donor User",
        phone_number: null,
        avatar_url: null,
        bio: null,
        address: null,
        role: Role.DONOR,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    } as any

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserAdminService,
                {
                    provide: AwsCognitoService,
                    useValue: {
                        updateUserAttributes: jest.fn(),
                        adminDisableUser: jest.fn(),
                        adminEnableUser: jest.fn(),
                    },
                },
                {
                    provide: UserAdminRepository,
                    useValue: {
                        updateUser: jest.fn(),
                        findAllUsers: jest.fn(),
                        getUsersByRole: jest.fn(),
                    },
                },
                {
                    provide: UserCommonRepository,
                    useValue: {
                        findUserById: jest.fn(),
                        findUserByCognitoId: jest.fn(),
                        updateUser: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<UserAdminService>(UserAdminService)
        userAdminRepository = module.get(UserAdminRepository)
        userCommonRepository = module.get(UserCommonRepository)
        awsCognitoService = module.get(AwsCognitoService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("updateStaffAccount", () => {
        const updateData = { full_name: "Updated Staff" }

        it("should update staff account successfully", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(mockStaff)
            userAdminRepository.updateUser.mockResolvedValue({
                ...mockStaff,
                full_name: "Updated Staff",
            })

            const result = await service.updateStaffAccount(
                "staff-123",
                updateData,
                "admin-123",
            )

            expect(result.full_name).toBe("Updated Staff")
            expect(userAdminRepository.updateUser).toHaveBeenCalledWith(
                "staff-123",
                updateData,
            )
        })

        it("should throw error if admin is not authorized", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockDonor)

            await expect(
                service.updateStaffAccount(
                    "staff-123",
                    updateData,
                    "donor-123",
                ),
            ).rejects.toThrow(
                "Unauthorized: Only admins can update staff accounts",
            )
        })

        it("should throw error if staff not found", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(null)

            await expect(
                service.updateStaffAccount(
                    "staff-123",
                    updateData,
                    "admin-123",
                ),
            ).rejects.toThrow(NotFoundException)
        })

        it("should throw error if target is not staff", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(mockDonor)

            await expect(
                service.updateStaffAccount(
                    "donor-123",
                    updateData,
                    "admin-123",
                ),
            ).rejects.toThrow("Can only update staff accounts")
        })
    })

    describe("getAllAccounts", () => {
        it("should get all accounts with pagination", async () => {
            const mockUsers = [mockAdmin, mockStaff, mockDonor]
            userAdminRepository.findAllUsers.mockResolvedValue(mockUsers)

            const result = await service.getAllAccounts(0, 10)

            expect(result).toEqual(mockUsers)
            expect(userAdminRepository.findAllUsers).toHaveBeenCalledWith(0, 10)
        })

        it("should use default pagination values", async () => {
            userAdminRepository.findAllUsers.mockResolvedValue([])

            await service.getAllAccounts()

            expect(userAdminRepository.findAllUsers).toHaveBeenCalledWith(0, 10)
        })
    })

    describe("updateAccountStatus", () => {
        it("should deactivate user account successfully", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(mockDonor)
            userAdminRepository.updateUser.mockResolvedValue({
                ...mockDonor,
                is_active: false,
            })

            const result = await service.updateAccountStatus(
                "donor-123",
                false,
                "admin-123",
            )

            expect(result.is_active).toBe(false)
            expect(userAdminRepository.updateUser).toHaveBeenCalledWith(
                "donor-123",
                { is_active: false },
            )
        })

        it("should throw error if non-admin tries to update status", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockDonor)

            await expect(
                service.updateAccountStatus("donor-123", false, "donor-123"),
            ).rejects.toThrow(
                "Unauthorized: Only admins can update account status",
            )
        })

        it("should throw error when deactivating admin account", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(mockAdmin)

            await expect(
                service.updateAccountStatus("admin-123", false, "admin-123"),
            ).rejects.toThrow("Cannot deactivate admin accounts")
        })

        it("should throw error if target user not found", async () => {
            userCommonRepository.findUserById
                .mockResolvedValueOnce(mockAdmin)
                .mockResolvedValueOnce(null)

            await expect(
                service.updateAccountStatus("user-123", false, "admin-123"),
            ).rejects.toThrow(NotFoundException)
        })
    })

    describe("getStaffAccounts", () => {
        it("should get all staff accounts", async () => {
            const mockKitchenStaff = [
                { ...mockStaff, role: Role.KITCHEN_STAFF },
            ]
            const mockDeliveryStaff = [
                { ...mockStaff, role: Role.DELIVERY_STAFF },
            ]
            const mockFundraisers = [{ ...mockStaff, role: Role.FUNDRAISER }]

            userAdminRepository.getUsersByRole
                .mockResolvedValueOnce(mockKitchenStaff)
                .mockResolvedValueOnce(mockDeliveryStaff)
                .mockResolvedValueOnce(mockFundraisers)

            const result = await service.getStaffAccounts()

            expect(result).toHaveLength(3)
            expect(userAdminRepository.getUsersByRole).toHaveBeenCalledTimes(3)
        })
    })

    describe("getDonorAccounts", () => {
        it("should get all donor accounts", async () => {
            const mockDonors = [mockDonor]
            userAdminRepository.getUsersByRole.mockResolvedValue(mockDonors)

            const result = await service.getDonorAccounts()

            expect(result).toEqual(mockDonors)
            expect(userAdminRepository.getUsersByRole).toHaveBeenCalledWith(
                Role.DONOR,
            )
        })
    })

    describe("updateUserAccount", () => {
        const updateData = {
            full_name: "Updated Name",
            is_active: true,
        }

        it("should update user account successfully", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockDonor)
            userCommonRepository.updateUser.mockResolvedValue({
                ...mockDonor,
                full_name: "Updated Name",
            })

            const result = await service.updateUserAccount(
                "donor-123",
                updateData,
            )

            expect(result.full_name).toBe("Updated Name")
        })

        it("should throw error if user not found", async () => {
            userCommonRepository.findUserById.mockResolvedValue(null)

            await expect(
                service.updateUserAccount("user-123", updateData),
            ).rejects.toThrow(NotFoundException)
        })

        it("should prevent deactivating admin accounts", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockAdmin)

            await expect(
                service.updateUserAccount("admin-123", { is_active: false }),
            ).rejects.toThrow("Cannot deactivate admin accounts")
        })

        it("should sync with Cognito when disabling user", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockDonor)
            userCommonRepository.updateUser.mockResolvedValue({
                ...mockDonor,
                is_active: false,
            })
            awsCognitoService.adminDisableUser.mockResolvedValue({
                disabled: true,
            })

            await service.updateUserAccount("donor-123", { is_active: false })

            expect(awsCognitoService.adminDisableUser).toHaveBeenCalledWith(
                "donor@example.com",
            )
        })

        it("should sync with Cognito when enabling user", async () => {
            const inactiveUser = { ...mockDonor, is_active: false }
            userCommonRepository.findUserById.mockResolvedValue(inactiveUser)
            userCommonRepository.updateUser.mockResolvedValue({
                ...mockDonor,
                is_active: true,
            })
            awsCognitoService.adminEnableUser.mockResolvedValue({
                enabled: true,
            })

            await service.updateUserAccount("donor-123", { is_active: true })

            expect(awsCognitoService.adminEnableUser).toHaveBeenCalledWith(
                "donor@example.com",
            )
        })

        it("should handle Cognito sync errors gracefully", async () => {
            userCommonRepository.findUserById.mockResolvedValue(mockDonor)
            userCommonRepository.updateUser.mockResolvedValue({
                ...mockDonor,
                is_active: false,
            })
            awsCognitoService.adminDisableUser.mockRejectedValue(
                new Error("Cognito error"),
            )

            // Should not throw, just log error
            const result = await service.updateUserAccount("donor-123", {
                is_active: false,
            })

            expect(result).toBeDefined()
        })
    })

    describe("getAdminProfile", () => {
        it("should get admin profile successfully", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(
                mockAdmin,
            )

            const result = await service.getAdminProfile("cognito-admin")

            expect(result.user).toEqual(mockAdmin)
        })

        it("should throw error if admin not found", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(null)

            await expect(
                service.getAdminProfile("cognito-admin"),
            ).rejects.toThrow(NotFoundException)
        })

        it("should throw error if user is not admin", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(
                mockDonor,
            )

            await expect(
                service.getAdminProfile("cognito-donor"),
            ).rejects.toThrow("User is not an admin")
        })
    })

    describe("getAllUsers", () => {
        it("should get all users with pagination", async () => {
            const mockUsers = [mockAdmin, mockStaff, mockDonor]
            userAdminRepository.findAllUsers.mockResolvedValue(mockUsers)

            const result = await service.getAllUsers(0, 10)

            expect(result).toEqual(mockUsers)
            expect(userAdminRepository.findAllUsers).toHaveBeenCalledWith(0, 10)
        })
    })
})
