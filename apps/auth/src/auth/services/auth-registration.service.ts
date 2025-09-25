import { Injectable, Logger } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import {
    GetUserCommandOutput,
    AdminGetUserCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider"
import { ConfirmSignUpInput, SignUpInput } from "../dto"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
} from "../models"
import { AuthErrorHelper } from "../helpers"
import { GrpcClientService } from "libs/grpc"

@Injectable()
export class AuthRegistrationService {
    private readonly logger = new Logger(AuthRegistrationService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
    ) {}

    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        function extractUserNameFromEmail(email: string): string {
            if (typeof email !== "string") return ""
            const atIndex = email.indexOf("@")
            if (atIndex > 0) {
                return email.substring(0, atIndex)
            }
            return ""
        }
        try {
            this.logger.log(
                `Attempting to sign up user with email: ${input.email}`,
            )

            const result = await this.awsCognitoService.signUp(
                input.email,
                input.password,
                {
                    name: input.name,
                    phone_number: input.phoneNumber,
                },
            )

            const userResult = await this.grpcClient.callUserService(
                "CreateUser",
                {
                    cognito_id: result.userSub || "",
                    email: input.email,
                    username: extractUserNameFromEmail(input.email),
                    full_name: input.name,
                    phone_number: input.phoneNumber,
                    role: "DONOR",
                },
            )

            if (!userResult.success) {
                throw new Error(
                    `Failed to create user in database: ${userResult.error}`,
                )
            }

            this.logger.log(`User signed up successfully: ${result.userSub}`)

            return {
                userSub: result.userSub || "",
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            }
        } catch (error) {
            this.logger.error(`Sign up failed for ${input.email}:`, error)
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
