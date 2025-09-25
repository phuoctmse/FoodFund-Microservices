import { HttpStatus } from "@nestjs/common"
import { BaseException } from "libs/exceptions"

// Auth-specific exceptions that extend the base exceptions

// === AUTH BUSINESS LOGIC ERRORS ===
export class UserAlreadyExistsException extends BaseException {
    readonly errorCode = "AUTH_101"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string) {
        super(`User with email ${email} already exists`, HttpStatus.CONFLICT, {
            email,
        })
    }
}

export class UserNotConfirmedException extends BaseException {
    readonly errorCode = "AUTH_102"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string) {
        super(
            `User ${email} is not confirmed. Please check your email for confirmation code.`,
            HttpStatus.FORBIDDEN,
            { email },
        )
    }
}

export class InvalidCredentialsException extends BaseException {
    readonly errorCode = "AUTH_103"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string) {
        super("Invalid email or password", HttpStatus.UNAUTHORIZED, { email })
    }
}

export class AccountLockedException extends BaseException {
    readonly errorCode = "AUTH_104"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string, lockReason: string) {
        super(`Account is locked: ${lockReason}`, HttpStatus.FORBIDDEN, {
            email,
            lockReason,
        })
    }
}

export class InvalidConfirmationCodeException extends BaseException {
    readonly errorCode = "AUTH_105"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string) {
        super("Invalid or expired confirmation code", HttpStatus.BAD_REQUEST, {
            email,
        })
    }
}

export class ConfirmationCodeExpiredException extends BaseException {
    readonly errorCode = "AUTH_106"
    readonly errorType = "BUSINESS" as const
    readonly service = "auth-service"

    constructor(email: string) {
        super(
            "Confirmation code has expired. Please request a new one.",
            HttpStatus.BAD_REQUEST,
            { email },
        )
    }
}

// === AUTH EXTERNAL SERVICE ERRORS ===
export class CognitoServiceException extends BaseException {
    readonly errorCode = "AUTH_201"
    readonly errorType = "EXTERNAL" as const
    readonly service = "auth-service"

    constructor(operation: string, cognitoError: string) {
        super(
            `AWS Cognito error during ${operation}`,
            HttpStatus.SERVICE_UNAVAILABLE,
            { operation, cognitoError },
        )
    }
}

export class EmailServiceException extends BaseException {
    readonly errorCode = "AUTH_202"
    readonly errorType = "EXTERNAL" as const
    readonly service = "auth-service"

    constructor(email: string, reason: string) {
        super(
            "Failed to send email notification",
            HttpStatus.SERVICE_UNAVAILABLE,
            { email, reason },
        )
    }
}

// === AUTH SECURITY ERRORS ===
export class SuspiciousActivityException extends BaseException {
    readonly errorCode = "AUTH_303"
    readonly errorType = "SECURITY" as const
    readonly service = "auth-service"

    constructor(activity: string, userAgent?: string, ip?: string) {
        super(
            `Suspicious activity detected: ${activity}`,
            HttpStatus.FORBIDDEN,
            { activity, userAgent, ip },
        )
    }
}
