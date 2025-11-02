import { Test, TestingModule } from "@nestjs/testing"
import { UnauthorizedException } from "@nestjs/common"
import { AuthApplicationService } from "../auth-application.service"
import { IAuthProvider } from "../../../domain/interfaces/auth-provider.interface"
import { IUserService } from "../../../domain/interfaces/user-service.interface"
import { UserMapper } from "../../../shared/mappers/user.mapper"
import { UserInactiveException } from "../../../domain/exceptions/user-inactive.exception"

describe("AuthApplicationService", () => {
    let service: AuthApplicationService
    let mockAuthProvider: jest.Mocked<IAuthProvider>
    let mockUserService: jest.Mocked<IUserService>
    let userMapper: UserMapper

    beforeEach(async () => {
        // Create mocks
        mockAuthProvider = {
            signUp: jest.fn(),
            signIn: jest.fn(),
            getUser: jest.fn(),
            getUserByUsername: jest.fn(),
            signOut: jest.fn(),
            refreshToken: jest.fn(),
            confirmSignUp: jest.fn(),
            resendConfirmationCode: jest.fn(),
            forgotPassword: jest.fn(),
            confirmForgotPassword: jest.fn(),
            changePassword: jest.fn(),
            deleteUser: jest.fn(),
            adminConfirmSignUp: jest.fn(),
            generateTokensForOAuthUser: jest.fn(),
        }

        mockUserService = {
            createUser: jest.fn(),
            getUser: jest.fn(),
            updateUser: jest.fn(),
            deleteUser: jest.fn(),
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthApplicationService,
                {
                    provide: "IAuthProvider",
                    useValue: mockAuthProvider,
                },
                {
                    provide: "IUserService",
                    useValue: mockUserService,
                },
                UserMapper,
            ],
        }).compile()

        service = module.get<AuthApplicationService>(AuthApplicationService)
        userMapper = module.get<UserMapper>(UserMapper)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("signIn", () => {
        const signInDto = {
            email: "test@example.com",
            password: "Password123!",
        }

        const mockAuthResult = {
            accessToken: "access-token-123",
            refreshToken: "refresh-token-123",
            idToken: "id-token-123",
            expiresIn: 3600,
        }

        const mockProviderUser = {
            sub: "cognito-123",
            email: "test@example.com",
            emailVerified: true,
            username: "test@example.com",
            name: "Test User",
        }

        it("should successfully sign in an active user", async () => {
            mockAuthProvider.signIn.mockResolvedValue(mockAuthResult)
            mockAuthProvider.getUser.mockResolvedValue(mockProviderUser)
            mockUserService.getUser.mockResolvedValue({
                success: true,
                user: {
                    id: "cognito-123",
                    email: "test@example.com",
                    isActive: true,
                },
            })

            const result = await service.signIn(signInDto)

            expect(result).toEqual({
                accessToken: "access-token-123",
                refreshToken: "refresh-token-123",
                idToken: "id-token-123",
                expiresIn: 3600,
                user: {
                    id: "cognito-123",
                    email: "test@example.com",
                    username: "test@example.com",
                    name: "Test User",
                    emailVerified: true,
                    provider: "cognito",
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                },
                message: "Sign in successful",
            })

            expect(mockAuthProvider.signIn).toHaveBeenCalledWith(
                signInDto.email,
                signInDto.password,
            )
            expect(mockAuthProvider.getUser).toHaveBeenCalledWith(
                "access-token-123",
            )
            expect(mockUserService.getUser).toHaveBeenCalledWith("cognito-123")
        })

        it("should throw UserInactiveException if user is inactive", async () => {
            mockAuthProvider.signIn.mockResolvedValue(mockAuthResult)
            mockAuthProvider.getUser.mockResolvedValue(mockProviderUser)
            mockUserService.getUser.mockResolvedValue({
                success: true,
                user: {
                    id: "cognito-123",
                    email: "test@example.com",
                    isActive: false,
                },
            })

            await expect(service.signIn(signInDto)).rejects.toThrow(
                UserInactiveException,
            )
        })

        it("should throw UnauthorizedException if user not found in User Service", async () => {
            mockAuthProvider.signIn.mockResolvedValue(mockAuthResult)
            mockAuthProvider.getUser.mockResolvedValue(mockProviderUser)
            mockUserService.getUser.mockResolvedValue({
                success: false,
            })

            await expect(service.signIn(signInDto)).rejects.toThrow(
                UnauthorizedException,
            )
        })
    })

    describe("signUp", () => {
        const signUpDto = {
            email: "newuser@example.com",
            password: "Password123!",
            name: "New User",
        }

        it("should successfully sign up a new user", async () => {
            mockAuthProvider.signUp.mockResolvedValue({
                userSub: "cognito-456",
            })
            mockUserService.createUser.mockResolvedValue({
                success: true,
            })

            const result = await service.signUp(signUpDto)

            expect(result).toEqual({
                userSub: "cognito-456",
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            })

            expect(mockAuthProvider.signUp).toHaveBeenCalledWith(
                signUpDto.email,
                signUpDto.password,
                expect.objectContaining({
                    name: signUpDto.name,
                }),
            )
            expect(mockUserService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    cognitoId: "cognito-456",
                    email: signUpDto.email,
                    fullName: signUpDto.name,
                }),
            )
        })

        it("should throw error if User Service fails", async () => {
            mockAuthProvider.signUp.mockResolvedValue({
                userSub: "cognito-456",
            })
            mockUserService.createUser.mockResolvedValue({
                success: false,
                error: "Database error",
            })

            await expect(service.signUp(signUpDto)).rejects.toThrow(
                "User Service failed",
            )
        })
    })

    describe("signOut", () => {
        it("should successfully sign out user", async () => {
            const accessToken = "access-token-123"
            mockAuthProvider.signOut.mockResolvedValue({ success: true })

            const result = await service.signOut(accessToken)

            expect(result).toEqual({ success: true })
            expect(mockAuthProvider.signOut).toHaveBeenCalledWith(accessToken)
        })
    })

    describe("verifyToken", () => {
        it("should successfully verify token and return user", async () => {
            const accessToken = "access-token-123"
            const mockProviderUser = {
                sub: "cognito-123",
                email: "test@example.com",
                emailVerified: true,
                username: "test@example.com",
                name: "Test User",
            }

            mockAuthProvider.getUser.mockResolvedValue(mockProviderUser)

            const result = await service.verifyToken(accessToken)

            expect(result.id).toBe("cognito-123")
            expect(result.email).toBe("test@example.com")
            expect(mockAuthProvider.getUser).toHaveBeenCalledWith(accessToken)
        })
    })

    describe("confirmSignUp", () => {
        it("should successfully confirm sign up", async () => {
            const email = "test@example.com"
            const code = "123456"

            mockAuthProvider.confirmSignUp.mockResolvedValue(undefined)

            await service.confirmSignUp(email, code)

            expect(mockAuthProvider.confirmSignUp).toHaveBeenCalledWith(
                email,
                code,
            )
        })
    })

    describe("forgotPassword", () => {
        it("should successfully initiate forgot password", async () => {
            const email = "test@example.com"

            mockAuthProvider.forgotPassword.mockResolvedValue(undefined)

            await service.forgotPassword(email)

            expect(mockAuthProvider.forgotPassword).toHaveBeenCalledWith(email)
        })
    })

    describe("confirmForgotPassword", () => {
        it("should successfully reset password", async () => {
            const email = "test@example.com"
            const code = "123456"
            const newPassword = "NewPassword123!"

            mockAuthProvider.confirmForgotPassword.mockResolvedValue(undefined)

            await service.confirmForgotPassword(email, code, newPassword)

            expect(mockAuthProvider.confirmForgotPassword).toHaveBeenCalledWith(
                email,
                code,
                newPassword,
            )
        })
    })

    describe("resendConfirmationCode", () => {
        it("should successfully resend confirmation code", async () => {
            const email = "test@example.com"

            mockAuthProvider.resendConfirmationCode.mockResolvedValue(undefined)

            const result = await service.resendConfirmationCode(email)

            expect(result).toEqual({
                emailSent: true,
                message: "Confirmation code sent to your email",
            })
            expect(
                mockAuthProvider.resendConfirmationCode,
            ).toHaveBeenCalledWith(email)
        })
    })

    describe("refreshToken", () => {
        it("should successfully refresh token", async () => {
            const refreshToken = "refresh-token-123"
            const userName = "test@example.com"

            mockAuthProvider.refreshToken.mockResolvedValue({
                accessToken: "new-access-token",
                idToken: "new-id-token",
                expiresIn: 3600,
            })

            const result = await service.refreshToken(refreshToken, userName)

            expect(result).toEqual({
                accessToken: "new-access-token",
                idToken: "new-id-token",
                expiresIn: 3600,
                message: "Token refreshed successfully",
            })
            expect(mockAuthProvider.refreshToken).toHaveBeenCalledWith(
                refreshToken,
                userName,
            )
        })
    })

    describe("changePassword", () => {
        it("should successfully change password", async () => {
            const userId = "cognito-123"
            const newPassword = "NewPassword123!"
            const confirmNewPassword = "NewPassword123!"

            mockAuthProvider.changePassword.mockResolvedValue(undefined)

            const result = await service.changePassword(
                userId,
                newPassword,
                confirmNewPassword,
            )

            expect(result).toBe(true)
            expect(mockAuthProvider.changePassword).toHaveBeenCalledWith(
                userId,
                newPassword,
            )
        })

        it("should throw error if passwords do not match", async () => {
            const userId = "cognito-123"
            const newPassword = "NewPassword123!"
            const confirmNewPassword = "DifferentPassword123!"

            await expect(
                service.changePassword(userId, newPassword, confirmNewPassword),
            ).rejects.toThrow(
                "New password and confirm new password do not match",
            )

            expect(mockAuthProvider.changePassword).not.toHaveBeenCalled()
        })
    })

    describe("checkCurrentPassword", () => {
        it("should return valid if password is correct", async () => {
            const userId = "test@example.com"
            const currentPassword = "Password123!"

            mockAuthProvider.signIn.mockResolvedValue({
                accessToken: "token",
                refreshToken: "refresh",
                idToken: "id",
                expiresIn: 3600,
            })

            const result = await service.checkCurrentPassword(
                userId,
                currentPassword,
            )

            expect(result).toEqual({
                isValid: true,
                message: "Password is valid",
            })
            expect(mockAuthProvider.signIn).toHaveBeenCalledWith(
                userId,
                currentPassword,
            )
        })

        it("should return invalid if password is incorrect", async () => {
            const userId = "test@example.com"
            const currentPassword = "WrongPassword"

            mockAuthProvider.signIn.mockRejectedValue(
                new Error("Invalid password"),
            )

            const result = await service.checkCurrentPassword(
                userId,
                currentPassword,
            )

            expect(result).toEqual({
                isValid: false,
                message: "Invalid password",
            })
        })
    })

    describe("getUserById", () => {
        it("should successfully get user by ID", async () => {
            const userId = "cognito-123"
            const mockProviderUser = {
                sub: "cognito-123",
                email: "test@example.com",
                emailVerified: true,
                username: "test@example.com",
                name: "Test User",
            }

            mockAuthProvider.getUserByUsername.mockResolvedValue(
                mockProviderUser,
            )

            const result = await service.getUserById(userId)

            expect(result?.id).toBe("cognito-123")
            expect(result?.email).toBe("test@example.com")
            expect(mockAuthProvider.getUserByUsername).toHaveBeenCalledWith(
                userId,
            )
        })

        it("should return null if user not found", async () => {
            const userId = "non-existent-user"

            mockAuthProvider.getUserByUsername.mockResolvedValue(null)

            const result = await service.getUserById(userId)

            expect(result).toBeNull()
        })
    })
})
