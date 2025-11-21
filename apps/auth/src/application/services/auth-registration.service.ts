import { Injectable, Logger } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { ConfirmSignUpInput, SignUpInput } from "../dtos"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
} from "../../domain/entities"
import { AuthErrorHelper } from "../../shared/helpers"
import { GrpcClientService } from "libs/grpc"
import { generateUniqueUsername, SagaOrchestrator } from "libs/common"
import { Role } from "../../domain/enums/role.enum"
import { SentryService } from "libs/observability"

@Injectable()
export class RegistrationService {
    private readonly logger = new Logger(RegistrationService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        const username = generateUniqueUsername(input.email)
        let cognitoUserSub: string | null = null

        const saga = new SagaOrchestrator(`User Registration: ${input.email}`, {
            logger: this.logger,
            onCompensationFailed: (stepName, error) => {
                // Send critical alert to Sentry for compensation failures
                this.sentryService.captureError(
                    new Error(
                        `CRITICAL: Saga compensation failed for ${stepName}`,
                    ),
                    {
                        compensationError: {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                            stack:
                                error instanceof Error
                                    ? error.stack
                                    : undefined,
                        },
                        userContext: {
                            email: input.email,
                            cognitoUserSub,
                            timestamp: new Date().toISOString(),
                            severity: "CRITICAL",
                            action: "MANUAL_CLEANUP_REQUIRED",
                            service: "auth-service",
                            operation: "user-registration-rollback",
                        },
                        tags: {
                            severity: "critical",
                            operation: "saga-rollback",
                            service: "auth-service",
                            requiresManualIntervention: "true",
                        },
                    },
                )

                this.sentryService.captureMessage(
                    `🚨 CRITICAL: Manual cleanup required for user registration ${input.email}`,
                    "error",
                    {
                        alertType: "manual-intervention-required",
                        priority: "P1",
                        email: input.email,
                        cognitoUserSub,
                    },
                )
            },
        })

        try {
            // Step 1: Create Cognito user
            saga.addStep({
                name: "Create Cognito User",
                execute: async () => {
                    const result = await this.awsCognitoService.signUp(
                        input.email,
                        input.password,
                        {
                            name: input.name,
                            "custom:role": Role.DONOR,
                        },
                    )
                    cognitoUserSub = result.userSub || ""
                    return result
                },
                compensate: async () => {
                    if (cognitoUserSub) {
                        await this.awsCognitoService.adminDeleteUser(
                            input.email,
                        )
                    }
                },
            })

            // Step 2: Create user profile in User Service
            saga.addStep({
                name: "Create User Profile",
                execute: async () => {
                    const userResult = await this.grpcClient.callUserService(
                        "CreateUser",
                        {
                            cognitoId: cognitoUserSub,
                            email: input.email,
                            username: username,
                            fullName: input.name,
                            role: Role.DONOR,
                        },
                    )

                    if (!userResult.success) {
                        throw new Error(
                            `User Service failed: ${userResult.error || "Unknown error"}`,
                        )
                    }

                    return userResult
                },
            })

            await saga.execute()

            return {
                userSub: cognitoUserSub!,
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            }
        } catch (error) {
            throw AuthErrorHelper.mapCognitoError(error, "signUp", input.email)
        }
    }

    async confirmSignUp(
        input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        try {
            this.logger.log(`Confirming sign up for email: ${input.email}`)

            await this.awsCognitoService.confirmSignUp(
                input.email,
                input.confirmationCode,
            )

            this.logger.log(
                `Sign up confirmed successfully for: ${input.email}`,
            )

            return {
                confirmed: true,
                message: "Email confirmed successfully. You can now sign in.",
            }
        } catch (error) {
            this.logger.error(
                `Confirm sign up failed for ${input.email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "confirmSignUp",
                input.email,
            )
        }
    }

    async resendConfirmationCode(
        email: string,
    ): Promise<ResendCodeResponse> {
        try {
            this.logger.log(`Resending confirmation code for: ${email}`)

            await this.awsCognitoService.resendConfirmationCode(email)

            this.logger.log(
                `Confirmation code resent successfully for: ${email}`,
            )

            return {
                emailSent: true,
                message: "Confirmation code sent to your email",
            }
        } catch (error) {
            this.logger.error(
                `Resend confirmation code failed for ${email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "resendConfirmationCode",
                email,
            )
        }
    }

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        try {
            this.logger.log(`Initiating forgot password for: ${email}`)

            await this.awsCognitoService.forgotPassword(email)

            this.logger.log(
                `Forgot password initiated successfully for: ${email}`,
            )

            return {
                emailSent: true,
                message: "Password reset code sent to your email",
            }
        } catch (error) {
            this.logger.error(`Forgot password failed for ${email}:`, error)
            throw AuthErrorHelper.mapCognitoError(
                error,
                "forgotPassword",
                email,
            )
        }
    }

    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ): Promise<ResetPasswordResponse> {
        try {
            this.logger.log(`Confirming forgot password for: ${email}`)

            await this.awsCognitoService.confirmForgotPassword(
                email,
                confirmationCode,
                newPassword,
            )

            this.logger.log(`Password reset successfully for: ${email}`)

            return {
                passwordReset: true,
                message:
                    "Password reset successful. You can now sign in with your new password.",
            }
        } catch (error) {
            this.logger.error(
                `Confirm forgot password failed for ${email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "confirmForgotPassword",
                email,
            )
        }
    }
}
