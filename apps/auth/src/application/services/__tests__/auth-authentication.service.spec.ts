import { Test, TestingModule } from "@nestjs/testing"
import { UnauthorizedException } from "@nestjs/common"
import { AuthAuthenticationService } from "../auth-authentication.service"
import { AwsCognitoService } from "libs/aws-cognito"
import { GrpcClientService } from "libs/grpc"
import { AuthErrorHelper } from "../../../shared/helpers"

describe("AuthAuthenticationService", () => {
    let service: AuthAuthenticationService
    let awsCognitoService: jest.Mocked<AwsCognitoService>
    let grpcClient: jest.Mocked<GrpcClientService>

    const mockAccessToken = "mock-access-token"
    const mockRefreshToken = "mock-refresh-token"
    const mockIdToken = "mock-id-token"
    const mockCognitoId = "cognito-123"
    const mockEmail = "test@example.com"

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthAuthenticationService,
                {
                    provide: AwsCognitoService,
                    useValue: {
                        signIn: jest.fn(),
                        getUser: jest.fn(),
                        refreshToken: jest.fn(),
                        signOut: jest.fn(),
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

        service = module.get<AuthAuthenticationService>(
            AuthAuthenticationService,
        )
        awsCognitoService = module.get(AwsCognitoService)
        grpcClient = module.get(GrpcClientService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("signIn", () => {
        const MOCK_PASSWORD = "TestPassword123!" // Mock password for testing only
        const signInInput = {
            email: mockEmail,
            password: MOCK_PASSWORD,
        }

        const mockCognitoResponse = {
            AccessToken: mockAccessToken,
            RefreshToken: mockRefreshToken,
            IdToken: mockIdToken,
            ExpiresIn: 3600,
        }

        const mockUserOutput = {
            Username: mockCognitoId,
            UserAttributes: [
                { Name: "sub", Value: mockCognitoId },
                { Name: "email", Value: mockEmail },
                { Name: "email_verified", Value: "true" },
                { Name: "name", Value: "Test User" },
            ],
            $metadata: {},
        } as any

        it("should sign in user successfully", async () => {
            awsCognitoService.signIn.mockResolvedValue(mockCognitoResponse)
            awsCognitoService.getUser.mockResolvedValue(mockUserOutput)
            grpcClient.callUserService.mockResolvedValue({
                success: true,
                user: {
                    cognitoId: mockCognitoId,
                    isActive: true,
                    email: mockEmail,
                },
            })

            const result = await service.signIn(signInInput)

            expect(result).toMatchObject({
                accessToken: mockAccessToken,
                refreshToken: mockRefreshToken,
                idToken: mockIdToken,
                expiresIn: 3600,
                message: "Sign in successful",
            })
            expect(result.user.id).toBe(mockCognitoId)
            expect(result.user.email).toBe(mockEmail)
        })

        it("should throw error if user is not active", async () => {
            awsCognitoService.signIn.mockResolvedValue(mockCognitoResponse)
            awsCognitoService.getUser.mockResolvedValue(mockUserOutput)
            grpcClient.callUserService.mockResolvedValue({
                success: true,
                user: {
                    cognitoId: mockCognitoId,
                    isActive: false,
                    email: mockEmail,
                },
            })

            await expect(service.signIn(signInInput)).rejects.toThrow()
        })

        it("should throw error if user not found in User Service", async () => {
            awsCognitoService.signIn.mockResolvedValue(mockCognitoResponse)
            awsCognitoService.getUser.mockResolvedValue(mockUserOutput)
            grpcClient.callUserService.mockResolvedValue({
                success: false,
                error: "User not found",
            })

            await expect(service.signIn(signInInput)).rejects.toThrow()
        })

        it("should handle Cognito errors", async () => {
            const cognitoError = new Error("Invalid credentials")
            awsCognitoService.signIn.mockRejectedValue(cognitoError)

            jest.spyOn(AuthErrorHelper, "mapCognitoError").mockImplementation(
                () => {
                    throw new UnauthorizedException("Invalid credentials")
                },
            )

            await expect(service.signIn(signInInput)).rejects.toThrow(
                UnauthorizedException,
            )
        })
    })

    describe("verifyToken", () => {
        const mockUserOutput = {
            Username: mockCognitoId,
            UserAttributes: [
                { Name: "sub", Value: mockCognitoId },
                { Name: "email", Value: mockEmail },
                { Name: "email_verified", Value: "true" },
                { Name: "name", Value: "Test User" },
            ],
            $metadata: {},
        } as any

        it("should verify token successfully", async () => {
            awsCognitoService.getUser.mockResolvedValue(mockUserOutput)

            const result = await service.verifyToken(mockAccessToken)

            expect(result.id).toBe(mockCognitoId)
            expect(result.email).toBe(mockEmail)
            expect(awsCognitoService.getUser).toHaveBeenCalledWith(
                mockAccessToken,
            )
        })

        it("should handle invalid token", async () => {
            const error = new Error("Invalid token")
            awsCognitoService.getUser.mockRejectedValue(error)

            jest.spyOn(AuthErrorHelper, "mapCognitoError").mockImplementation(
                () => {
                    throw new UnauthorizedException("Invalid token")
                },
            )

            await expect(service.verifyToken("invalid-token")).rejects.toThrow(
                UnauthorizedException,
            )
        })
    })

    describe("refreshToken", () => {
        const refreshInput = {
            refreshToken: mockRefreshToken,
            userName: "testuser",
        }

        const mockRefreshResponse = {
            AccessToken: "new-access-token",
            IdToken: "new-id-token",
            ExpiresIn: 3600,
        }

        it("should refresh token successfully", async () => {
            awsCognitoService.refreshToken.mockResolvedValue(
                mockRefreshResponse,
            )

            const result = await service.refreshToken(refreshInput)

            expect(result).toEqual({
                accessToken: "new-access-token",
                idToken: "new-id-token",
                expiresIn: 3600,
                message: "Token refreshed successfully",
            })
            expect(awsCognitoService.refreshToken).toHaveBeenCalledWith(
                mockRefreshToken,
                "testuser",
            )
        })

        it("should handle refresh token errors", async () => {
            const error = new Error("Invalid refresh token")
            awsCognitoService.refreshToken.mockRejectedValue(error)

            jest.spyOn(AuthErrorHelper, "mapCognitoError").mockImplementation(
                () => {
                    throw new UnauthorizedException("Invalid refresh token")
                },
            )

            await expect(service.refreshToken(refreshInput)).rejects.toThrow(
                UnauthorizedException,
            )
        })
    })

    describe("signOut", () => {
        it("should sign out successfully", async () => {
            awsCognitoService.signOut.mockResolvedValue({
                success: true,
            })

            const result = await service.signOut(mockAccessToken)

            expect(result).toEqual({
                success: true,
                message: "User signed out successfully",
            })
            expect(awsCognitoService.signOut).toHaveBeenCalledWith(
                mockAccessToken,
            )
        })

        it("should handle sign out errors", async () => {
            const error = new Error("Sign out failed")
            awsCognitoService.signOut.mockRejectedValue(error)

            jest.spyOn(AuthErrorHelper, "mapCognitoError").mockImplementation(
                () => {
                    throw new Error("Sign out failed")
                },
            )

            await expect(service.signOut(mockAccessToken)).rejects.toThrow()
        })
    })
})
