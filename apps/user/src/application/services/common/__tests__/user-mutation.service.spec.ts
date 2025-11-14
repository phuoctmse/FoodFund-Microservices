import { Test, TestingModule } from "@nestjs/testing"
import { UserMutationService } from "../user-mutation.service"
import { UserRepository } from "@app/user/src/application/repositories"
import { Role } from "apps/user/src/generated/user-client"

describe("UserMutationService", () => {
    let service: UserMutationService
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
                UserMutationService,
                {
                    provide: UserRepository,
                    useValue: {
                        updateUser: jest.fn(),
                        deleteUser: jest.fn(),
                        findUserById: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<UserMutationService>(UserMutationService)
        userRepository = module.get(UserRepository)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("updateUser", () => {
        const updateInput = {
            full_name: "Updated Name",
            phone_number: "0987654321",
            bio: "Updated bio",
        }

        it("should update user successfully", async () => {
            const updatedUser = {
                ...mockUser,
                full_name: "Updated Name",
                phone_number: "0987654321",
                bio: "Updated bio",
            }

            userRepository.updateUser.mockResolvedValue(updatedUser)

            const result = await service.updateUser("user-123", updateInput)

            expect(result).toEqual(updatedUser)
            expect(userRepository.updateUser).toHaveBeenCalledWith(
                "user-123",
                updateInput,
            )
        })

        it("should handle partial updates", async () => {
            const partialUpdate = {
                full_name: "New Name",
            }

            const updatedUser = {
                ...mockUser,
                full_name: "New Name",
            }

            userRepository.updateUser.mockResolvedValue(updatedUser)

            const result = await service.updateUser("user-123", partialUpdate)

            expect(result.full_name).toBe("New Name")
            expect(userRepository.updateUser).toHaveBeenCalledWith(
                "user-123",
                partialUpdate,
            )
        })
    })

    describe("deleteUser", () => {
        it("should delete user successfully", async () => {
            userRepository.deleteUser.mockResolvedValue(mockUser)

            const result = await service.deleteUser("user-123")

            expect(result).toEqual(mockUser)
            expect(userRepository.deleteUser).toHaveBeenCalledWith("user-123")
        })
    })

    describe("activateUser", () => {
        it("should activate user successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            const result = await service.activateUser("user-123")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserById).toHaveBeenCalledWith("user-123")
        })
    })

    describe("deactivateUser", () => {
        it("should deactivate user successfully", async () => {
            userRepository.findUserById.mockResolvedValue(mockUser)

            const result = await service.deactivateUser("user-123")

            expect(result).toEqual(mockUser)
            expect(userRepository.findUserById).toHaveBeenCalledWith("user-123")
        })
    })
})
