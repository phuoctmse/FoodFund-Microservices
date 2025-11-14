import { Test, TestingModule } from "@nestjs/testing"
import { UserGrpcController } from "../user-grpc.controller"
import {
    UserCommonRepository,
    UserAdminRepository,
} from "../../../application/repositories"
import { Role } from "@libs/databases"

jest.mock("libs/common", () => ({
    generateUniqueUsername: jest.fn(
        (email: string) => `user_${email.split("@")[0]}`,
    ),
}))

describe("UserGrpcController", () => {
    let controller: UserGrpcController
    let userCommonRepository: jest.Mocked<UserCommonRepository>
    let userAdminRepository: jest.Mocked<UserAdminRepository>

    const mockUser = {
        id: "user-123",
        cognito_id: "cognito-123",
        email: "test@example.com",
        user_name: "user_test",
        full_name: "Test User",
        phone_number: "0123456789",
        avatar_url: "https://example.com/avatar.jpg",
        bio: "Test bio",
        role: Role.DONOR,
        is_active: true,
        address: null,
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-01"),
        Organizations: [],
        Organization_Member: [],
    } as any

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserGrpcController],
            providers: [
                {
                    provide: UserCommonRepository,
                    useValue: {
                        createUser: jest.fn(),
                        findUserByCognitoId: jest.fn(),
                        findUserByEmail: jest.fn(),
                    },
                },
                {
                    provide: UserAdminRepository,
                    useValue: {
                        updateUser: jest.fn(),
                    },
                },
            ],
        }).compile()

        controller = module.get<UserGrpcController>(UserGrpcController)
        userCommonRepository = module.get(UserCommonRepository)
        userAdminRepository = module.get(UserAdminRepository)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("health", () => {
        it("should return health status", async () => {
            const result = await controller.health()

            expect(result).toMatchObject({
                status: "healthy",
                service: "user-service",
            })
            expect(result.timestamp).toBeDefined()
            expect(result.uptime).toBeGreaterThanOrEqual(0)
        })
    })

    describe("createUser", () => {
        const createUserRequest = {
            cognitoId: "cognito-123",
            email: "test@example.com",
            fullName: "Test User",
            cognitoAttributes: {
                avatarUrl: "https://example.com/avatar.jpg",
                bio: "Test bio",
            },
        }

        it("should create user successfully", async () => {
            userCommonRepository.createUser.mockResolvedValue(mockUser)

            const result = await controller.createUser(createUserRequest)

            expect(result.success).toBe(true)
            expect(result.user).toMatchObject({
                id: "user-123",
                cognitoId: "cognito-123",
                email: "test@example.com",
                fullName: "Test User",
            })
            expect(result.error).toBeNull()
            expect(userCommonRepository.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    cognito_id: "cognito-123",
                    email: "test@example.com",
                    role: Role.DONOR,
                }),
            )
        })

        it("should return error if cognitoId is missing", async () => {
            const result = await controller.createUser({
                ...createUserRequest,
                cognitoId: "",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Cognito ID and email are required")
            expect(userCommonRepository.createUser).not.toHaveBeenCalled()
        })

        it("should return error if email is missing", async () => {
            const result = await controller.createUser({
                ...createUserRequest,
                email: "",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Cognito ID and email are required")
        })

        it("should handle creation failure", async () => {
            userCommonRepository.createUser.mockResolvedValue(null as any)

            const result = await controller.createUser(createUserRequest)

            expect(result.success).toBe(false)
            expect(result.error).toBe("Failed to create user")
        })

        it("should handle repository errors", async () => {
            userCommonRepository.createUser.mockRejectedValue(
                new Error("Database error"),
            )

            const result = await controller.createUser(createUserRequest)

            expect(result.success).toBe(false)
            expect(result.error).toBe("Database error")
        })
    })

    describe("getUser", () => {
        it("should get user by cognitoId successfully", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(mockUser)

            const result = await controller.getUser({
                cognitoId: "cognito-123",
            })

            expect(result.success).toBe(true)
            expect(result.user).toMatchObject({
                id: "user-123",
                cognitoId: "cognito-123",
                email: "test@example.com",
            })
            expect(result.error).toBeNull()
        })

        it("should return error if cognitoId is missing", async () => {
            const result = await controller.getUser({ cognitoId: "" })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Cognito ID is required")
        })

        it("should return error if user not found", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(
                null as any,
            )

            const result = await controller.getUser({
                cognitoId: "cognito-123",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("User not found")
        })

        it("should handle repository errors", async () => {
            userCommonRepository.findUserByCognitoId.mockRejectedValue(
                new Error("Database error"),
            )

            const result = await controller.getUser({
                cognitoId: "cognito-123",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Database error")
        })
    })

    describe("getUserByEmail", () => {
        it("should get user by email successfully", async () => {
            userCommonRepository.findUserByEmail.mockResolvedValue(mockUser)

            const result = await controller.getUserByEmail({
                email: "test@example.com",
            })

            expect(result.success).toBe(true)
            expect(result.user.email).toBe("test@example.com")
        })

        it("should return error if email is missing", async () => {
            const result = await controller.getUserByEmail({ email: "" })

            expect(result.success).toBe(false)
            expect(result.error).toBe("Email is required")
        })

        it("should return error if user not found", async () => {
            userCommonRepository.findUserByEmail.mockResolvedValue(null as any)

            const result = await controller.getUserByEmail({
                email: "notfound@example.com",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("User not found")
        })
    })

    describe("updateUser", () => {
        const updateRequest = {
            id: "user-123",
            fullName: "Updated Name",
            phoneNumber: "0987654321",
            bio: "Updated bio",
        }

        it("should update user successfully", async () => {
            const updatedUser = {
                ...mockUser,
                full_name: "Updated Name",
            } as any
            userAdminRepository.updateUser.mockResolvedValue(updatedUser)

            const result = await controller.updateUser(updateRequest)

            expect(result.success).toBe(true)
            expect(result.user.fullName).toBe("Updated Name")
            expect(userAdminRepository.updateUser).toHaveBeenCalledWith(
                "user-123",
                expect.objectContaining({
                    full_name: "Updated Name",
                    phone_number: "0987654321",
                    bio: "Updated bio",
                }),
            )
        })

        it("should return error if id is missing", async () => {
            const result = await controller.updateUser({
                ...updateRequest,
                id: "",
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe("User ID is required")
        })

        it("should handle update errors", async () => {
            userAdminRepository.updateUser.mockRejectedValue(
                new Error("Update failed"),
            )

            const result = await controller.updateUser(updateRequest)

            expect(result.success).toBe(false)
            expect(result.error).toBe("Update failed")
        })
    })

    describe("userExists", () => {
        it("should return true if user exists", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(mockUser)

            const result = await controller.userExists({
                cognitoId: "cognito-123",
            })

            expect(result.exists).toBe(true)
            expect(result.userId).toBe("user-123")
            expect(result.error).toBeNull()
        })

        it("should return false if user does not exist", async () => {
            userCommonRepository.findUserByCognitoId.mockResolvedValue(null)

            const result = await controller.userExists({
                cognitoId: "cognito-123",
            })

            expect(result.exists).toBe(false)
            expect(result.userId).toBe("")
        })

        it("should return false if cognitoId is missing", async () => {
            const result = await controller.userExists({ cognitoId: "" })

            expect(result.exists).toBe(false)
            expect(result.userId).toBe("")
        })

        it("should handle errors gracefully", async () => {
            userCommonRepository.findUserByCognitoId.mockRejectedValue(
                new Error("Database error"),
            )

            const result = await controller.userExists({
                cognitoId: "cognito-123",
            })

            expect(result.exists).toBe(false)
            expect(result.error).toBe("Database error")
        })
    })
})

