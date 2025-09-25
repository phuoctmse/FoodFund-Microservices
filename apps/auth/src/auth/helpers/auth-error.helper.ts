import {
    InvalidEmailFormatException,
    WeakPasswordException,
    MissingRequiredFieldException,
    InvalidTokenException,
    TokenExpiredException,
    TooManyAttemptsException,
} from "libs/exceptions"
import {
    UserAlreadyExistsException,
    UserNotConfirmedException,
    InvalidCredentialsException,
    AccountLockedException,
    InvalidConfirmationCodeException,
    ConfirmationCodeExpiredException,
    CognitoServiceException,
    EmailServiceException,
    SuspiciousActivityException,
} from "../exceptions"

export class AuthErrorHelper {
    // Validation helpers
    static throwInvalidEmail(email: string): never {
        throw new InvalidEmailFormatException(email)
    }

    static throwWeakPassword(requirements: string[]): never {
        throw new WeakPasswordException(requirements)
    }

    static throwMissingField(field: string): never {
        throw new MissingRequiredFieldException(field)
    }

    // Business logic helpers
    static throwUserAlreadyExists(email: string): never {
        throw new UserAlreadyExistsException(email)
    }

    static throwUserNotConfirmed(email: string): never {
        throw new UserNotConfirmedException(email)
    }

    static throwInvalidCredentials(email: string): never {
        throw new InvalidCredentialsException(email)
    }

    static throwAccountLocked(email: string, reason: string): never {
        throw new AccountLockedException(email, reason)
    }

    static throwInvalidConfirmationCode(email: string): never {
        throw new InvalidConfirmationCodeException(email)
    }

    static throwConfirmationCodeExpired(email: string): never {
        throw new ConfirmationCodeExpiredException(email)
    }

    static throwTooManyAttempts(email: string, retryAfter: number): never {
        throw new TooManyAttemptsException(email, retryAfter)
    }

    // External service helpers
    static throwCognitoError(operation: string, cognitoError: string): never {
        throw new CognitoServiceException(operation, cognitoError)
    }

    static throwEmailServiceError(email: string, reason: string): never {
        throw new EmailServiceException(email, reason)
    }

    // Security helpers
    static throwInvalidToken(tokenType: string): never {
        throw new InvalidTokenException(tokenType)
    }

    static throwTokenExpired(tokenType: string): never {
        throw new TokenExpiredException(tokenType)
    }

    static throwSuspiciousActivity(
        activity: string,
        userAgent?: string,
        ip?: string,
    ): never {
        throw new SuspiciousActivityException(activity, userAgent, ip)
    }

    // Business validation utilities (keep only business logic validations)
    static validateBusinessRules(email: string, operation: string): void {
        // Example: Check if email domain is allowed for this operation
        // This is business logic, not basic validation
        const blockedDomains = ["tempmail.com", "guerrillamail.com"]
        const domain = email.split("@")[1]?.toLowerCase()

        if (blockedDomains.includes(domain)) {
            throw new InvalidEmailFormatException(
                `Email domain ${domain} is not allowed`,
            )
        }
    }

    static validatePasswordComplexity(password: string): void {
        // Business rule: Check against common passwords or company-specific rules
        const commonPasswords = ["password", "123456", "qwerty"]

        if (commonPasswords.includes(password.toLowerCase())) {
            this.throwWeakPassword([
                "Password is too common, please choose a more secure password",
            ])
        }
    }

    // Cognito error mapper
    static mapCognitoError(
        cognitoError: any,
        operation: string,
        email?: string,
    ): never {
        const errorCode =
            cognitoError.name || cognitoError.code || "UnknownError"

        switch (errorCode) {
        case "UsernameExistsException":
            this.throwUserAlreadyExists(email || "unknown")
            break

        case "UserNotConfirmedException":
            this.throwUserNotConfirmed(email || "unknown")
            break

        case "NotAuthorizedException":
            this.throwInvalidCredentials(email || "unknown")
            break

        case "UserNotFoundException":
            this.throwInvalidCredentials(email || "unknown")
            break

        case "CodeMismatchException":
            this.throwInvalidConfirmationCode(email || "unknown")
            break

        case "ExpiredCodeException":
            this.throwConfirmationCodeExpired(email || "unknown")
            break

        case "TooManyRequestsException":
            this.throwTooManyAttempts(email || "unknown", 5)
            break

        case "InvalidPasswordException":
            this.throwWeakPassword([
                "Password does not meet AWS Cognito requirements",
            ])
            break

        default:
            this.throwCognitoError(
                operation,
                `${errorCode}: ${cognitoError.message}`,
            )
        }
    }
}
