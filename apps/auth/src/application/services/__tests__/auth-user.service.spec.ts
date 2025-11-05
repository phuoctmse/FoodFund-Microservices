import { Test, TestingModule } from "@nestjs/testing"
import { AuthUserService } from "../auth-user.service"
import { AwsCognitoService } from "libs/aws-cognito"
import { GrpcClientService } from "libs/grpc"

jest.mock("@libs/env", () => ({
    envConfig: jest.fn(() => ({
        google: {
            clientId: "mock-google-client-id",
        },
    })),
}))

describe("AuthUserService", () => {
    let service: AuthUserService
    let awsCognitoService: jest.Mocked<AwsCognitoService>
    let grpcClient: jest.Mocked<GrpcClientService>

    const mockUserId = "cognito-123"
    const mockEmail = "test@example.com"
    const MOCK_PASSWORD = "TestPassword123!" // Mock password for testing only
    const MOCK_NEW_PASSWORD = "NewTestPassword456!" // Mock new password for testing only

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthUserService,
                {
                    provide: AwsCognitoService,
                    useValue: {
                        getUserByUsername: jest.fn(),
                        changePassword: jest.fn(),
                        signIn: jest.fn(),
                        signUp: jest.fn(),
                        adminConfirmSignUp: jest.fn(),
                        adminDeleteUser: jest.fn(),
                        generateTokensForOAuthUser: jest.fn(),
                    },
                },
                {
                    provide: GrpcClientService,
                    useValue: {
                        callUserService: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<AuthUserService>(AuthUserService)
        awsCognitoService = module.get(AwsCognitoService)
        grpcClient = module.get(GrpcClientService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("getUserById", () => {
        const mockUserOutput = {
            Username: mockUserId,
            UserAttributes: [
                { Name: "sub", Value: mockUserId },
                { Name: "email", Value: mockEmail },
                { Name: "email_verified", Value: "true" },
                { Name: "name", Value: "Test User" },
            ],
            UserCreateDate: new Date(),
            UserLastModifiedDate: new Date(),
            $metadata: {},
        } as any

        it("should get user by ID successfully", async () => {
            awsCognitoService.getUserByUsername.mockResolvedValue(
                mockUserOutput,
            )

            const result = await service.getUserById(mockUserId)

            expect(result).toBeDefined()
            expect(result?.id).toBe(mockUserId)
            expect(result?.email).toBe(mockEmail)
            expect(awsCognitoService.getUserByUsername).toHaveBeenCalledWith(
                mockUserId,
            )
        })

        it("should return null if user not found", async () => {
            awsCognitoService.getUserByUsername.mockResolvedValue(null as any)

            const result = await service.getUserById(mockUserId)

            expect(result).toBeNull()
        })
    })

    describe("changePassword", () => {
        const changePasswordInput = {
            newPassword: MOCK_NEW_PASSWORD,
            confirmNewPassword: MOCK_NEW_PASSWORD,
        }

        it("should change password successfully", async () => {
            awsCognitoService.changePassword.mockResolvedValue(true)

            const result = await service.changePassword(
                mockUserId,
                changePasswordInput,
            )

            expect(result).toBe(true)
            expect(awsCognitoService.changePassword).toHaveBeenCalledWith(
                mockUserId,
                MOCK_NEW_PASSWORD,
            )
        })

        it("should throw error if passwords do not match", async () => {
            const input = {
                newPassword: MOCK_NEW_PASSWORD,
                confirmNewPassword: "DifferentMockPassword789!",
            }

            await expect(
                service.changePassword(mockUserId, input),
            ).rejects.toThrow(
                "New password and confirm new password do not match",
            )
        })
    })

    describe("checkCurrentPassword", () => {
        it("should return valid if password is correct", async () => {
            awsCognitoService.signIn.mockResolvedValue({
                AccessToken: "token",
            })

            const result = await service.checkCurrentPassword(mockUserId, {
                currentPassword: MOCK_PASSWORD,
            })

            expect(result).toEqual({
                isValid: true,
                message: "Password is valid",
            })
        })

        it("should return invalid if password is incorrect", async () => {
            awsCognitoService.signIn.mockRejectedValue(
                new Error("Invalid password"),
            )

            const result = await service.checkCurrentPassword(mockUserId, {
                currentPassword: "WrongMockPassword",
            })

            expect(result).toEqual({
                isValid: false,
                message: "Invalid password",
            })
        })
    })

    describe("googleAuthentication", () => {
        const mockGoogleInput = {
            idToken: "mock-google-id-token",
        }

        const mockGoogleUserInfo = {
            sub: "google-123",
            email: "google@example.com",
            name: "Google User",
            picture: "https://example.com/photo.jpg",
            email_verified: "true",
        }

        const mockUserOutput = {
            Username: "google@example.com",
            UserAttributes: [
                { Name: "sub", Value: "cognito-456" },
                { Name: "email", Value: "google@example.com" },
                { Name: "name", Value: "Google User" },
            ],
            UserCreateDate: new Date(),
            UserLastModifiedDate: new Date(),
            $metadata: {},
        } as any

        beforeEach(() => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            ...mockGoogleUserInfo,
                            aud: "mock-google-client-id", // Match the mocked client ID
                        }),
                }),
            ) as jest.Mock
        })

        it("should authenticate existing Google user", async () => {
            awsCognitoService.getUserByUsername.mockResolvedValue(
                mockUserOutput,
            )
            awsCognitoService.generateTokensForOAuthUser.mockResolvedValue({
                AccessToken: "access-token",
                RefreshToken: "refresh-token",
                IdToken: "id-token",
            })

            const result = await service.googleAuthentication(mockGoogleInput)

            expect(result.isNewUser).toBe(false)
            expect(result.user.email).toBe("google@example.com")
            expect(result.accessToken).toBe("access-token")
        })

        it("should create and authenticate new Google user", async () => {
            awsCognitoService.getUserByUsername
                .mockRejectedValueOnce(new Error("User not found"))
                .mockResolvedValueOnce(mockUserOutput)

            awsCognitoService.signUp.mockResolvedValue({
                userSub: "cognito-456",
            })
            awsCognitoService.adminConfirmSignUp.mockResolvedValue({} as any)
            awsCognitoService.generateTokensForOAuthUser.mockResolvedValue({
                AccessToken: "access-token",
                RefreshToken: "refresh-token",
                IdToken: "id-token",
            })
            grpcClient.callUserService.mockResolvedValue({
                success: true,
                user: { cognitoId: "cognito-456" },
            })

            const result = await service.googleAuthentication(mockGoogleInput)

            expect(result.isNewUser).toBe(true)
            expect(result.user.email).toBe("google@example.com")
            expect(awsCognitoService.signUp).toHaveBeenCalled()
            expect(grpcClient.callUserService).toHaveBeenCalledWith(
                "CreateUser",
                expect.any(Object),
            )
        })

        it("should handle invalid Google token", async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: false,
                }),
            ) as jest.Mock

            await expect(
                service.googleAuthentication(mockGoogleInput),
            ).rejects.toThrow()
        })
    })

    describe("validateUser", () => {
        it("should validate user successfully", async () => {
            const mockUser = {
                id: mockUserId,
                email: mockEmail,
                username: "testuser",
                name: "Test User",
                phoneNumber: "",
                emailVerified: true,
                provider: "cognito",
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const result = await service.validateUser(mockUser)

            expect(result).toEqual({
                user: mockUser,
                message: "User validated successfully",
            })
        })
    })
})
