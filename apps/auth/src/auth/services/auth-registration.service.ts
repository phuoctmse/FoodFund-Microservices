import { Injectable, Logger } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { ConfirmSignUpInput, SignUpInput } from "../dto"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
} from "../models"
import { AuthErrorHelper } from "../helpers"
import { GrpcClientService } from "libs/grpc"
import { generateUniqueUsername } from "libs/common"
import { Role } from "../enum/role.enum"
import { SentryService } from "libs/observability"

@Injectable()
export class AuthRegistrationService {
    private readonly logger = new Logger(AuthRegistrationService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        let cognitoUserSub: string | null = null
        let cognitoCreated = false

        try {
            this.logger.log(
                `[SAGA] Step 1: Creating Cognito user for ${input.email}`,
            )

            const result = await this.awsCognitoService.signUp(
                input.email,
                input.password,
                {
                    name: input.name,
                    "custom:role": Role.DONOR,
                },
            )

            cognitoUserSub = result.userSub || ""
            cognitoCreated = true

            this.logger.log(
                `[SAGA] Step 1 SUCCESS: Cognito user created with ID: ${cognitoUserSub}`,
            )

            this.logger.log(
                `[SAGA] Step 2: Creating user profile in User Service for ${input.email}`,
            )

            const username = generateUniqueUsername(input.email)

            const userResult = await this.grpcClient.callUserService(
                "CreateUser",
                {
                    cognito_id: cognitoUserSub,
                    email: input.email,
                    username: username,
                    full_name: input.name,
                    role: Role.DONOR,
                },
            )

            if (!userResult.success) {
                throw new Error(
                    `User Service failed: ${userResult.error || "Unknown error"}`,
                )
            }

            this.logger.log(
                "[SAGA] Step 2 SUCCESS: User profile created in database",
            )

            this.logger.log(
                `[SAGA] COMPLETED: User registration successful for ${input.email}`,
            )

            return {
                userSub: cognitoUserSub,
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            }
        } catch (error) {
            this.logger.error(
                `[SAGA] FAILED at step ${cognitoCreated ? "2 (User Service)" : "1 (Cognito)"}: ${error}`,
            )

            // If Cognito user was created but User Service failed, rollback Cognito
            if (cognitoCreated && cognitoUserSub) {
                await this.rollbackCognitoUser(input.email, cognitoUserSub)
            }

            // Map and throw appropriate error
            throw AuthErrorHelper.mapCognitoError(error, "signUp", input.email)
        }
    }

    private async rollbackCognitoUser(
        email: string,
        cognitoUserSub: string,
    ): Promise<void> {
        try {
            this.logger.warn(
                `[SAGA ROLLBACK] Attempting to delete Cognito user: ${email} (${cognitoUserSub})`,
            )

            await this.awsCognitoService.adminDeleteUser(email)

            this.logger.log(
                `[SAGA ROLLBACK] SUCCESS: Cognito user deleted: ${email}`,
            )
        } catch (rollbackError) {
            // Critical: Rollback failed - log for manual intervention
            const errorContext = {
                cognitoUserSub,
                email,
                timestamp: new Date().toISOString(),
                severity: "CRITICAL",
                action: "MANUAL_CLEANUP_REQUIRED",
                service: "auth-service",
                operation: "user-registration-rollback",
                issue: "Cognito user exists but User Service profile was not created",
                instructions: [
                    "1. Verify if Cognito user exists in AWS Console",
                    "2. Check if User Service has profile for this email",
                    "3. Manually delete Cognito user if no profile exists",
                    "4. Contact user to retry registration",
                ].join(" | "),
            }

            this.logger.error(
                `[SAGA ROLLBACK] FAILED: Could not delete Cognito user ${email}`,
                errorContext,
            )

            // Send critical alert to Sentry for immediate attention
            this.sentryService.captureError(
                new Error(
                    `CRITICAL: User registration rollback failed for ${email}`,
                ),
                {
                    rollbackError: {
                        message:
                            rollbackError instanceof Error
                                ? rollbackError.message
                                : String(rollbackError),
                        stack:
                            rollbackError instanceof Error
                                ? rollbackError.stack
                                : undefined,
                    },
                    userContext: errorContext,
                    tags: {
                        severity: "critical",
                        operation: "saga-rollback",
                        service: "auth-service",
                        requiresManualIntervention: "true",
                    },
                },
            )

            // Also send a high-priority message to Sentry
            this.sentryService.captureMessage(
                `🚨 CRITICAL: Manual cleanup required for Cognito user ${email} (${cognitoUserSub})`,
                "error",
                {
                    alertType: "manual-intervention-required",
                    priority: "P1",
                    ...errorContext,
                },
            )
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
    ): Promise<{ emailSent: boolean; message: string }> {
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
