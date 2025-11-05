import { Test, TestingModule } from "@nestjs/testing"
import { AuthRegistrationService } from "../auth-registration.service"
import { AwsCognitoService } from "libs/aws-cognito"
import { GrpcClientService } from "libs/grpc"
import { SentryService } from "libs/observability"
import { Role } from "../../../domain/enums/role.enum"

jest.mock("libs/common", () => ({
    generateUniqueUsername: jest.fn(
        (email: string) => `user_${email.split("@")[0]}`,
    ),
    SagaOrchestrator: jest.fn().mockImplementation((name, options) => {
        const steps: any[] = []
        return {
            addStep: jest.fn((step) => steps.push(step)),
            execute: jest.fn(async () => {
                for (const step of steps) {
                    try {
                        await step.execute()
                    } catch (error) {
                        // Rollback on error
                        for (let i = steps.indexOf(step); i >= 0; i--) {
                            if (steps[i].compensate) {
                                await steps[i].compensate()
                            }
                        }
                        throw error
                    }
                }
            }),
        }
    }),
}))

describe("AuthRegistrationService", () => {
    let service: AuthRegistrationService
    let awsCognitoService: jest.Mocked<AwsCognitoService>
    let grpcClient: jest.Mocked<GrpcClientService>
    let sentryService: jest.Mocked<SentryService>

    const mockEmail = "test@example.com"
    const mockUserSub = "cognito-123"

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthRegistrationService,
                {
                    provide: AwsCognitoService,
                    useValue: {
                        signUp: jest.fn(),
                        confirmSignUp: jest.fn(),
                        resendConfirmationCode: jest.fn(),
                        forgotPassword: jest.fn(),
                        confirmForgotPassword: jest.fn(),
                        adminDeleteUser: jest.fn(),
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
            ],
        }).compile()

        service = module.get<AuthRegistrationService>(AuthRegistrationService)
        awsCognitoService = module.get(AwsCognitoService)
        grpcClient = module.get(GrpcClientService)
        sentryService = module.get(SentryService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("signUp", () => {
        const MOCK_PASSWORD = "TestPassword123!" // Mock password for testing only
        const signUpInput = {
            email: mockEmail,
            password: MOCK_PASSWORD,
            name: "Test User",
            bio: "Test bio",
        }

        it("should sign up user successfully", async () => {
            awsCognitoService.signUp.mockResolvedValue({
                userSub: mockUserSub,
                userConfirmed: false,
            })
            grpcClient.callUserService.mockResolvedValue({
                success: true,
                user: { cognitoId: mockUserSub },
            })

            const result = await service.signUp(signUpInput)

            expect(result).toEqual({
                userSub: mockUserSub,
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            })
            expect(awsCognitoService.signUp).toHaveBeenCalledWith(
                mockEmail,
                MOCK_PASSWORD,
                {
                    name: "Test User",
                    "custom:role": Role.DONOR,
                },
            )
            expect(grpcClient.callUserService).toHaveBeenCalledWith(
                "CreateUser",
                expect.objectContaining({
                    cognitoId: mockUserSub,
                    email: mockEmail,
                    fullName: "Test User",
                    role: Role.DONOR,
                }),
            )
        })

        it("should rollback Cognito user if User Service fails", async () => {
            awsCognitoService.signUp.mockResolvedValue({
                userSub: mockUserSub,
                userConfirmed: false,
            })
            awsCognitoService.adminDeleteUser.mockResolvedValue({} as any)
            grpcClient.callUserService.mockResolvedValue({
                success: false,
                error: "Database error",
            })

            await expect(service.signUp(signUpInput)).rejects.toThrow()
            // Saga will call compensate which deletes the user
            expect(awsCognitoService.adminDeleteUser).toHaveBeenCalled()
        })
    })

    describe("confirmSignUp", () => {
        const confirmInput = {
            email: mockEmail,
            confirmationCode: "123456",
        }

        it("should confirm sign up successfully", async () => {
            awsCognitoService.confirmSignUp.mockResolvedValue({} as any)

            const result = await service.confirmSignUp(confirmInput)

            expect(result).toEqual({
                confirmed: true,
                message: "Email confirmed successfully. You can now sign in.",
            })
            expect(awsCognitoService.confirmSignUp).toHaveBeenCalledWith(
                mockEmail,
                "123456",
            )
        })

        it("should handle invalid confirmation code", async () => {
            awsCognitoService.confirmSignUp.mockRejectedValue(
                new Error("Invalid code"),
            )

            await expect(service.confirmSignUp(confirmInput)).rejects.toThrow()
        })
    })

    describe("resendConfirmationCode", () => {
        it("should resend confirmation code successfully", async () => {
            awsCognitoService.resendConfirmationCode.mockResolvedValue(
                {} as any,
            )

            const result = await service.resendConfirmationCode(mockEmail)

            expect(result).toEqual({
                emailSent: true,
                message: "Confirmation code sent to your email",
            })
            expect(
                awsCognitoService.resendConfirmationCode,
            ).toHaveBeenCalledWith(mockEmail)
        })
    })

    describe("forgotPassword", () => {
        it("should initiate forgot password successfully", async () => {
            awsCognitoService.forgotPassword.mockResolvedValue({} as any)

            const result = await service.forgotPassword(mockEmail)

            expect(result).toEqual({
                emailSent: true,
                message: "Password reset code sent to your email",
            })
            expect(awsCognitoService.forgotPassword).toHaveBeenCalledWith(
                mockEmail,
            )
        })
    })

    describe("confirmForgotPassword", () => {
        it("should confirm forgot password successfully", async () => {
            awsCognitoService.confirmForgotPassword.mockResolvedValue({} as any)

            const result = await service.confirmForgotPassword(
                mockEmail,
                "123456",
                "NewPassword123!",
            )

            expect(result).toEqual({
                passwordReset: true,
                message:
                    "Password reset successful. You can now sign in with your new password.",
            })
            expect(
                awsCognitoService.confirmForgotPassword,
            ).toHaveBeenCalledWith(mockEmail, "123456", "NewPassword123!")
        })
    })
})
