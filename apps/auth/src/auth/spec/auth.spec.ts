import { Test, TestingModule } from "@nestjs/testing"
import { UnauthorizedException } from "@nestjs/common"
import { AuthService } from "../services/auth.service"
import { AwsCognitoService } from "libs/aws-cognito"
import { GrpcClientService } from "libs/grpc"
import { SentryService } from "libs/observability"
import { CognitoMapperHelper } from "../helpers/cognito-mapper.helper"
import { Role } from "../enum/role.enum"

describe("AuthService", () => {
    let service: AuthService
    let awsCognitoService: jest.Mocked<AwsCognitoService>
    let grpcClient: jest.Mocked<GrpcClientService>
    let sentryService: jest.Mocked<SentryService>
    let cognitoMapper: jest.Mocked<CognitoMapperHelper>

    const mockCognitoUser = {
        sub: "cognito-user-123",
        email: "test@example.com",
        emailVerified: true,
        username: "test@example.com",
        name: "Test User",
        phoneNumber: "+1234567890",
        provider: "cognito",
        cognitoUser: {} as any,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
    } as any

    const mockAuthUser = {
        id: "cognito-user-123",
        email: "test@example.com",
        username: "test@example.com",
        name: "Test User",
        phoneNumber: "+1234567890",
        emailVerified: true,
        provider: "cognito",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: AwsCognitoService,
                    useValue: {
                        signUp: jest.fn(),
                        signIn: jest.fn(),
                        getUser: jest.fn(),
                        confirmSignUp: jest.fn(),
                        resendConfirmationCode: jest.fn(),
                        forgotPassword: jest.fn(),
                        confirmForgotPassword: jest.fn(),
                        signOut: jest.fn(),
                        refreshToken: jest.fn(),
                        getUserByUsername: jest.fn(),
                        changePassword: jest.fn(),
                        adminDeleteUser: jest.fn(),
                        adminConfirmSignUp: jest.fn(),
                        generateTokensForOAuthUser: jest.fn(),
                    },
                },
                {
                    provide: GrpcClientService,
                    useValue: {
                        callUserService: jest.fn(),
                    },
                },
                {
                    provide: SentryService,
                    useValue: {
                        captureError: jest.fn(),
                        captureMessage: jest.fn(),
                    },
                },
                {
                    provide: CognitoMapperHelper,
                    useValue: {
                        fromGetUserOutput: jest.fn(),
                        fromAdminGetUserOutput: jest.fn(),
                        toAuthUser: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<AuthService>(AuthService)
        awsCognitoService = module.get(AwsCognitoService)
        grpcClient = module.get(GrpcClientService)
        sentryService = module.get(SentryService)
        cognitoMapper = module.get(CognitoMapperHelper)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("Authentication", () => {
        describe("signIn", () => {
            const signInInput = {
                email: "test@example.com",
                password: "Password123!",
            }

            it("should successfully sign in an active user", async () => {
                const mockAuthResult = {
                    AccessToken: "access-token-123",
                    RefreshToken: "refresh-token-123",
                    IdToken: "id-token-123",
                    ExpiresIn: 3600,
                }
                const mockUserOutput = { Username: "test@example.com" }
                const mockGrpcResult = {
                    success: true,
                    user: { is_active: true, email: "test@example.com" },
                }

                awsCognitoService.signIn.mockResolvedValue(mockAuthResult)
                awsCognitoService.getUser.mockResolvedValue(
                    mockUserOutput as any,
                )
                cognitoMapper.fromGetUserOutput.mockReturnValue(mockCognitoUser)
                cognitoMapper.toAuthUser.mockReturnValue(mockAuthUser)
                grpcClient.callUserService.mockResolvedValue(mockGrpcResult)

                const result = await service.signIn(signInInput)

                expect(result).toEqual({
                    user: mockAuthUser,
                    accessToken: "access-token-123",
                    refreshToken: "refresh-token-123",
                    idToken: "id-token-123",
                    expiresIn: 3600,
                    message: "Sign in successful",
                })
                expect(awsCognitoService.signIn).toHaveBeenCalledWith(
                    signInInput.email,
                    signInInput.password,
                )
                expect(grpcClient.callUserService).toHaveBeenCalledWith(
                    "GetUser",
                    { cognito_id: mockCognitoUser.sub },
                )
            })

            it("should throw error if user is inactive", async () => {
                const mockAuthResult = {
                    AccessToken: "access-token-123",
                    RefreshToken: "refresh-token-123",
                    IdToken: "id-token-123",
                    ExpiresIn: 3600,
                }
                const mockUserOutput = { Username: "test@example.com" }
                const mockGrpcResult = {
                    success: true,
                    user: { is_active: false },
                }

                awsCognitoService.signIn.mockResolvedValue(mockAuthResult)
                awsCognitoService.getUser.mockResolvedValue(
                    mockUserOutput as any,
                )
                cognitoMapper.fromGetUserOutput.mockReturnValue(mockCognitoUser)
                grpcClient.callUserService.mockResolvedValue(mockGrpcResult)

                await expect(service.signIn(signInInput)).rejects.toThrow()
            })

            it("should throw error if user not found in User Service", async () => {
                const mockAuthResult = {
                    AccessToken: "access-token-123",
                    RefreshToken: "refresh-token-123",
                    IdToken: "id-token-123",
                    ExpiresIn: 3600,
                }
                const mockUserOutput = { Username: "test@example.com" }
                const mockGrpcResult = { success: false }

                awsCognitoService.signIn.mockResolvedValue(mockAuthResult)
                awsCognitoService.getUser.mockResolvedValue(
                    mockUserOutput as any,
                )
                cognitoMapper.fromGetUserOutput.mockReturnValue(mockCognitoUser)
                grpcClient.callUserService.mockResolvedValue(mockGrpcResult)

                await expect(service.signIn(signInInput)).rejects.toThrow()
            })
        })

        describe("signOut", () => {
            it("should successfully sign out user", async () => {
                const accessToken = "access-token-123"
                awsCognitoService.signOut.mockResolvedValue({
                    success: true,
                })

                const result = await service.signOut(accessToken)

                expect(result).toEqual({
                    success: true,
                    message: "User signed out successfully",
                    timestamp: expect.any(String),
                })
                expect(awsCognitoService.signOut).toHaveBeenCalledWith(
                    accessToken,
                )
            })
        })

        describe("verifyToken", () => {
            it("should successfully verify token and return user", async () => {
                const accessToken = "access-token-123"
                const mockUserOutput = { Username: "test@example.com" }

                awsCognitoService.getUser.mockResolvedValue(
                    mockUserOutput as any,
                )
                cognitoMapper.fromGetUserOutput.mockReturnValue(mockCognitoUser)
                cognitoMapper.toAuthUser.mockReturnValue(mockAuthUser)

                const result = await service.verifyToken(accessToken)

                expect(result).toEqual(mockAuthUser)
                expect(awsCognitoService.getUser).toHaveBeenCalledWith(
                    accessToken,
                )
                expect(cognitoMapper.fromGetUserOutput).toHaveBeenCalledWith(
                    mockUserOutput,
                )
                expect(cognitoMapper.toAuthUser).toHaveBeenCalledWith(
                    mockCognitoUser,
                )
            })
        })

        describe("refreshToken", () => {
            it("should successfully refresh token", async () => {
                const refreshInput = {
                    refreshToken: "refresh-token-123",
                    userName: "test@example.com",
                }
                const mockRefreshResult = {
                    AccessToken: "new-access-token",
                    IdToken: "new-id-token",
                    ExpiresIn: 3600,
                }

                awsCognitoService.refreshToken.mockResolvedValue(
                    mockRefreshResult,
                )

                const result = await service.refreshToken(refreshInput)

                expect(result).toEqual({
                    accessToken: "new-access-token",
                    idToken: "new-id-token",
                    expiresIn: 3600,
                    message: "Token refreshed successfully",
                })
                expect(awsCognitoService.refreshToken).toHaveBeenCalledWith(
                    refreshInput.refreshToken,
                    refreshInput.userName,
                )
            })
        })
    })

    describe("Registration", () => {
        describe("confirmSignUp", () => {
            const confirmInput = {
                email: "test@example.com",
                confirmationCode: "123456",
            }

            it("should successfully confirm sign up", async () => {
                awsCognitoService.confirmSignUp.mockResolvedValue({} as any)

                const result = await service.confirmSignUp(confirmInput)

                expect(result).toEqual({
                    confirmed: true,
                    message: "Email confirmed successfully. You can now sign in.",
                })
                expect(awsCognitoService.confirmSignUp).toHaveBeenCalledWith(
                    confirmInput.email,
                    confirmInput.confirmationCode,
                )
            })
        })

        describe("resendConfirmationCode", () => {
            it("should successfully resend confirmation code", async () => {
                const email = "test@example.com"
                awsCognitoService.resendConfirmationCode.mockResolvedValue(
                    {} as any,
                )

                const result = await service.resendConfirmationCode(email)

                expect(result).toEqual({
                    emailSent: true,
                    message: "Confirmation code sent to your email",
                })
                expect(
                    awsCognitoService.resendConfirmationCode,
                ).toHaveBeenCalledWith(email)
            })
        })
    })

    describe("Password Management", () => {
        describe("forgotPassword", () => {
            it("should successfully initiate forgot password", async () => {
                const email = "test@example.com"
                awsCognitoService.forgotPassword.mockResolvedValue({} as any)

                const result = await service.forgotPassword(email)

                expect(result).toEqual({
                    emailSent: true,
                    message: "Password reset code sent to your email",
                })
                expect(awsCognitoService.forgotPassword).toHaveBeenCalledWith(
                    email,
                )
            })
        })

        describe("confirmForgotPassword", () => {
            it("should successfully reset password", async () => {
                const email = "test@example.com"
                const code = "123456"
                const newPassword = "NewPassword123!"

                awsCognitoService.confirmForgotPassword.mockResolvedValue(
                    {} as any,
                )

                const result = await service.confirmForgotPassword(
                    email,
                    code,
                    newPassword,
                )

                expect(result).toEqual({
                    passwordReset: true,
                    message:
                        "Password reset successful. You can now sign in with your new password.",
                })
                expect(
                    awsCognitoService.confirmForgotPassword,
                ).toHaveBeenCalledWith(email, code, newPassword)
            })
        })

        describe("changePassword", () => {
            it("should successfully change password", async () => {
                const userId = "cognito-user-123"
                const changePasswordInput = {
                    newPassword: "NewPassword123!",
                    confirmNewPassword: "NewPassword123!",
                }

                awsCognitoService.changePassword.mockResolvedValue(true)

                const result = await service.changePassword(
                    userId,
                    changePasswordInput,
                )

                expect(result).toBe(true)
                expect(awsCognitoService.changePassword).toHaveBeenCalledWith(
                    userId,
                    changePasswordInput.newPassword,
                )
            })

            it("should throw error if passwords do not match", async () => {
                const userId = "cognito-user-123"
                const changePasswordInput = {
                    newPassword: "NewPassword123!",
                    confirmNewPassword: "DifferentPassword123!",
                }

                await expect(
                    service.changePassword(userId, changePasswordInput),
                ).rejects.toThrow(
                    "New password and confirm new password do not match",
                )

                expect(awsCognitoService.changePassword).not.toHaveBeenCalled()
            })
        })

        describe("checkCurrentPassword", () => {
            it("should return valid if password is correct", async () => {
                const userId = "test@example.com"
                const checkPasswordInput = {
                    currentPassword: "Password123!",
                }

                awsCognitoService.signIn.mockResolvedValue({
                    AccessToken: "token",
                } as any)

                const result = await service.checkCurrentPassword(
                    userId,
                    checkPasswordInput,
                )

                expect(result).toEqual({
                    isValid: true,
                    message: "Password is valid",
                })
                expect(awsCognitoService.signIn).toHaveBeenCalledWith(
                    userId,
                    checkPasswordInput.currentPassword,
                )
            })

            it("should return invalid if password is incorrect", async () => {
                const userId = "test@example.com"
                const checkPasswordInput = {
                    currentPassword: "WrongPassword",
                }

                awsCognitoService.signIn.mockRejectedValue(
                    new Error("Invalid password"),
                )

                const result = await service.checkCurrentPassword(
                    userId,
                    checkPasswordInput,
                )

                expect(result).toEqual({
                    isValid: false,
                    message: "Invalid password",
                })
            })
        })
    })

    describe("User Management", () => {
        describe("getUserById", () => {
            it("should successfully get user by ID", async () => {
                const userId = "cognito-user-123"
                const mockUserOutput = { Username: userId }

                awsCognitoService.getUserByUsername.mockResolvedValue(
                    mockUserOutput as any,
                )
                cognitoMapper.fromAdminGetUserOutput.mockReturnValue(
                    mockCognitoUser,
                )
                cognitoMapper.toAuthUser.mockReturnValue(mockAuthUser)

                const result = await service.getUserById(userId)

                expect(result).toEqual(mockAuthUser)
                expect(
                    awsCognitoService.getUserByUsername,
                ).toHaveBeenCalledWith(userId)
                expect(
                    cognitoMapper.fromAdminGetUserOutput,
                ).toHaveBeenCalledWith(mockUserOutput)
            })

            it("should return null if user not found", async () => {
                const userId = "non-existent-user"

                awsCognitoService.getUserByUsername.mockResolvedValue(null as any)

                const result = await service.getUserById(userId)

                expect(result).toBeNull()
                expect(
                    awsCognitoService.getUserByUsername,
                ).toHaveBeenCalledWith(userId)
            })
        })

        describe("validateUser", () => {
            it("should return validated user response", async () => {
                const result = await service.validateUser(mockAuthUser)

                expect(result).toEqual({
                    user: mockAuthUser,
                    message: "User validated successfully",
                })
            })
        })
    })

    describe("Edge Cases", () => {
        it("should handle Cognito service errors gracefully", async () => {
            const signInInput = {
                email: "test@example.com",
                password: "Password123!",
            }

            awsCognitoService.signIn.mockRejectedValue(
                new Error("Cognito service unavailable"),
            )

            await expect(service.signIn(signInInput)).rejects.toThrow()
        })

        it("should handle gRPC service errors gracefully", async () => {
            const signInInput = {
                email: "test@example.com",
                password: "Password123!",
            }
            const mockAuthResult = {
                AccessToken: "access-token-123",
                RefreshToken: "refresh-token-123",
                IdToken: "id-token-123",
                ExpiresIn: 3600,
            }
            const mockUserOutput = { Username: "test@example.com" }

            awsCognitoService.signIn.mockResolvedValue(mockAuthResult)
            awsCognitoService.getUser.mockResolvedValue(mockUserOutput as any)
            cognitoMapper.fromGetUserOutput.mockReturnValue(mockCognitoUser)
            grpcClient.callUserService.mockRejectedValue(
                new Error("gRPC service unavailable"),
            )

            await expect(service.signIn(signInInput)).rejects.toThrow()
        })
    })
})
