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
} from "../../domain/exceptions"

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
        const errorMessage = cognitoError.message || ""

        if (operation === "signUp") {
            // UnauthorizedException + "user already exists" => treat as unconfirmed user path
            if (
                errorCode === "UnauthorizedException" &&
                errorMessage.toLowerCase().includes("user already exists")
            ) {
                this.throwUserNotConfirmed(email || "unknown")
            }
            // UsernameExistsException during signUp typically means confirmed user already exists
            if (errorCode === "UsernameExistsException") {
                this.throwUserAlreadyExists(email || "unknown")
            }
            if (errorCode === "UserNotConfirmedException") {
                this.throwUserNotConfirmed(email || "unknown")
            }
        }

        // Map standard Cognito errors
        if (errorCode === "UsernameExistsException") {
            this.throwUserAlreadyExists(email || "unknown")
        }

        if (errorCode === "UserNotConfirmedException") {
            this.throwUserNotConfirmed(email || "unknown")
        }

        if (
            errorCode === "NotAuthorizedException" ||
            errorCode === "UnauthorizedException"
        ) {
            this.throwInvalidCredentials(email || "unknown")
        }

        if (errorCode === "UserNotFoundException") {
            this.throwInvalidCredentials(email || "unknown")
        }

        if (errorCode === "CodeMismatchException") {
            this.throwInvalidConfirmationCode(email || "unknown")
        }

        if (errorCode === "ExpiredCodeException") {
            this.throwConfirmationCodeExpired(email || "unknown")
        }

        if (errorCode === "TooManyRequestsException") {
            this.throwTooManyAttempts(email || "unknown", 5)
        }

        if (errorCode === "InvalidPasswordException") {
            this.throwWeakPassword([
                "Password does not meet AWS Cognito requirements",
            ])
        }

        // Default: throw generic Cognito error
        this.throwCognitoError(
            operation,
            `${errorCode}: ${cognitoError.message}`,
        )
    }
}
