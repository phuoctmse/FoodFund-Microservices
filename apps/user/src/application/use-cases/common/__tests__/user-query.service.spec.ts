import { Test, TestingModule } from "@nestjs/testing"
import { UserQueryService } from "../user-query.service"
import { UserRepository } from "@app/user/src/domain/repositories"
import { Role } from "apps/user/src/generated/user-client"

describe("UserQueryService", () => {
    let service: UserQueryService
    let userRepository: jest.Mocked<UserRepository>

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

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserQueryService,
                {
                    provide: UserRepository,
                    useValue: {
                        findAllUsers: jest.fn(),
                        findUserById: jest.fn(),
                        findUserByEmail: jest.fn(),
                        findUserByUsername: jest.fn(),
                        findUserByCognitoId: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<UserQueryService>(UserQueryService)
        userRepository = module.get(UserRepository)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("findAllUsers", () => {
        it("should return all users with pagination", async () => {
            const mockUsers = [mockUser, { ...mockUser, id: "user-456" }]
            userRepository.findAllUsers.mockResolvedValue(mockUsers)

            const result = await service.findAllUsers(0, 10)

            expect(result).toEqual(mockUsers)
            expect(userRepository.findAllUsers).toHaveBeenCalledWith(0, 10)
        })

        it("should return all users without pagination", async () => {
            const mockUsers = [mockUser]
            userRepository.findAllUsers.mockResolvedValue(mockUsers)

            const result = await service.findAllUsers()

            expect(result).toEqual(mockUsers)
            expect(userRepository.findAllUsers).toHaveBeenCalledWith(
                undefined,
                undefined,
            )
        })
    })

    describe("findUserById", () => {
        it("should find user by ID successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            const result = await service.findUserById("user-123")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserById).toHaveBeenCalledWith("user-123")
        })

        it("should return null if user not found", async () => {
            userRepository.findUserById.mockResolvedValue(null)

            const result = await service.findUserById("nonexistent")

            expect(result).toBeNull()
        })
    })

    describe("findUserByEmail", () => {
        it("should find user by email successfully", async () => {
            userRepository.findUserByEmail.mockResolvedValue(mockUser)

            const result = await service.findUserByEmail("test@example.com")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserByEmail).toHaveBeenCalledWith(
                "test@example.com",
            )
        })

        it("should return null if user not found", async () => {
            userRepository.findUserByEmail.mockResolvedValue(null)

            const result = await service.findUserByEmail("notfound@example.com")

            expect(result).toBeNull()
        })
    })

    describe("findUserByUsername", () => {
        it("should find user by username successfully", async () => {
            userRepository.findUserByUsername.mockResolvedValue(mockUser)

            const result = await service.findUserByUsername("testuser")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserByUsername).toHaveBeenCalledWith(
                "testuser",
            )
        })

        it("should return null if user not found", async () => {
            userRepository.findUserByUsername.mockResolvedValue(null)

            const result = await service.findUserByUsername("nonexistent")

            expect(result).toBeNull()
        })
    })

    describe("findUserByCognitoId", () => {
        it("should find user by Cognito ID successfully", async () => {
            userRepository.findUserByCognitoId.mockResolvedValue(mockUser)

            const result = await service.findUserByCognitoId("cognito-123")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserByCognitoId).toHaveBeenCalledWith(
                "cognito-123",
            )
        })

        it("should return null if user not found", async () => {
            userRepository.findUserByCognitoId.mockResolvedValue(null)

            const result = await service.findUserByCognitoId("nonexistent")

            expect(result).toBeNull()
        })
    })

    describe("resolveReference", () => {
        it("should resolve GraphQL federation reference", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            const reference = {
                __typename: "User",
                id: "user-123",
            }

            const result = await service.resolveReference(reference)

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserById).toHaveBeenCalledWith("user-123")
        })

        it("should return null if reference not found", async () => {
            userRepository.findUserById.mockResolvedValue(null)

            const reference = {
                __typename: "User",
                id: "nonexistent",
            }

            const result = await service.resolveReference(reference)

            expect(result).toBeNull()
        })
    })
})
