import { HttpException, HttpStatus } from "@nestjs/common"

// Base Exception cho tất cả services
export abstract class BaseException extends HttpException {
    abstract readonly errorCode: string
    abstract readonly errorType:
        | "VALIDATION"
        | "BUSINESS"
        | "EXTERNAL"
        | "SECURITY"
    abstract readonly service: string

    constructor(
        message: string,
        status: HttpStatus,
        public readonly context?: Record<string, any>,
    ) {
        super(message, status)
    }

    toSentryContext() {
        return {
            errorCode: this.errorCode,
            errorType: this.errorType,
            service: this.service,
            context: this.context,
        }
    }
}

// === VALIDATION ERRORS (Common across services) ===
export class InvalidEmailFormatException extends BaseException {
    readonly errorCode = "VALIDATION_001"
    readonly errorType = "VALIDATION" as const
    readonly service = "common"

    constructor(email: string) {
        super(`Invalid email format: ${email}`, HttpStatus.BAD_REQUEST, {
            email,
        })
    }
}

export class WeakPasswordException extends BaseException {
    readonly errorCode = "VALIDATION_002"
    readonly errorType = "VALIDATION" as const
    readonly service = "common"

    constructor(requirements: string[]) {
        super(
            "Password does not meet security requirements",
            HttpStatus.BAD_REQUEST,
            { requirements },
        )
    }
}

export class MissingRequiredFieldException extends BaseException {
    readonly errorCode = "VALIDATION_003"
    readonly errorType = "VALIDATION" as const
    readonly service = "common"

    constructor(field: string) {
        super(`Required field missing: ${field}`, HttpStatus.BAD_REQUEST, {
            field,
        })
    }
}

export class InvalidPhoneNumberException extends BaseException {
    readonly errorCode = "VALIDATION_004"
    readonly errorType = "VALIDATION" as const
    readonly service = "common"

    constructor(phoneNumber: string) {
        super(
            `Invalid phone number format: ${phoneNumber}`,
            HttpStatus.BAD_REQUEST,
            { phoneNumber },
        )
    }
}

// === SECURITY ERRORS (Common across services) ===
export class InvalidTokenException extends BaseException {
    readonly errorCode = "SECURITY_001"
    readonly errorType = "SECURITY" as const
    readonly service = "common"

    constructor(tokenType: string) {
        super(`Invalid ${tokenType} token`, HttpStatus.UNAUTHORIZED, {
            tokenType,
        })
    }
}

export class TokenExpiredException extends BaseException {
    readonly errorCode = "SECURITY_002"
    readonly errorType = "SECURITY" as const
    readonly service = "common"

    constructor(tokenType: string) {
        super(`${tokenType} token has expired`, HttpStatus.UNAUTHORIZED, {
            tokenType,
        })
    }
}

export class UnauthorizedException extends BaseException {
    readonly errorCode = "SECURITY_003"
    readonly errorType = "SECURITY" as const
    readonly service = "common"

    constructor(reason?: string) {
        super(
            reason ? `Unauthorized: ${reason}` : "Unauthorized access",
            HttpStatus.UNAUTHORIZED,
            { reason },
        )
    }
}

export class ForbiddenException extends BaseException {
    readonly errorCode = "SECURITY_004"
    readonly errorType = "SECURITY" as const
    readonly service = "common"

    constructor(reason?: string) {
        super(
            reason ? `Forbidden: ${reason}` : "Access forbidden",
            HttpStatus.FORBIDDEN,
            { reason },
        )
    }
}

export class TooManyAttemptsException extends BaseException {
    readonly errorCode = "SECURITY_005"
    readonly errorType = "SECURITY" as const
    readonly service = "common"

    constructor(resource: string, retryAfter: number) {
        super(
            `Too many attempts for ${resource}. Please try again after ${retryAfter} minutes.`,
            HttpStatus.TOO_MANY_REQUESTS,
            { resource, retryAfter },
        )
    }
}

// === EXTERNAL SERVICE ERRORS (Common across services) ===
export class ExternalServiceException extends BaseException {
    readonly errorCode = "EXTERNAL_001"
    readonly errorType = "EXTERNAL" as const
    readonly service = "common"

    constructor(serviceName: string, operation: string, error: string) {
        super(
            `External service error: ${serviceName}`,
            HttpStatus.SERVICE_UNAVAILABLE,
            { serviceName, operation, error },
        )
    }
}

export class DatabaseException extends BaseException {
    readonly errorCode = "EXTERNAL_002"
    readonly errorType = "EXTERNAL" as const
    readonly service = "common"

    constructor(operation: string, error: string) {
        super(
            `Database error during ${operation}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            { operation, error },
        )
    }
}

// === BUSINESS LOGIC ERRORS (Common patterns) ===
export class ResourceNotFoundException extends BaseException {
    readonly errorCode = "BUSINESS_001"
    readonly errorType = "BUSINESS" as const
    readonly service = "common"

    constructor(resource: string, identifier: string) {
        super(`${resource} not found`, HttpStatus.NOT_FOUND, {
            resource,
            identifier,
        })
    }
}

export class ResourceAlreadyExistsException extends BaseException {
    readonly errorCode = "BUSINESS_002"
    readonly errorType = "BUSINESS" as const
    readonly service = "common"

    constructor(resource: string, identifier: string) {
        super(`${resource} already exists`, HttpStatus.CONFLICT, {
            resource,
            identifier,
        })
    }
}

export class InvalidOperationException extends BaseException {
    readonly errorCode = "BUSINESS_003"
    readonly errorType = "BUSINESS" as const
    readonly service = "common"

    constructor(operation: string, reason: string) {
        super(
            `Invalid operation: ${operation}. ${reason}`,
            HttpStatus.BAD_REQUEST,
            { operation, reason },
        )
    }
}
