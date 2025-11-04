import { HttpStatus } from "@nestjs/common"
import { BaseException } from "libs/exceptions"

// User service specific exceptions that extend the base exceptions

// === USER BUSINESS LOGIC ERRORS ===
export class UserNotFoundException extends BaseException {
    readonly errorCode = "USER_101"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(identifier: string, searchBy: string = "id") {
        super(
            `User not found with ${searchBy}: ${identifier}`,
            HttpStatus.NOT_FOUND,
            {
                identifier,
                searchBy,
            },
        )
    }
}

export class UserAlreadyExistsException extends BaseException {
    readonly errorCode = "USER_102"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(field: string, value: string) {
        super(
            `User with ${field} '${value}' already exists`,
            HttpStatus.CONFLICT,
            {
                field,
                value,
            },
        )
    }
}

export class UnauthorizedRoleException extends BaseException {
    readonly errorCode = "USER_103"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userRole: string, requiredRoles: string[]) {
        super(
            `User role '${userRole}' is not authorized. Required roles: ${requiredRoles.join(", ")}`,
            HttpStatus.FORBIDDEN,
            { userRole, requiredRoles },
        )
    }
}

// === ORGANIZATION ERRORS ===
export class OrganizationNotFoundException extends BaseException {
    readonly errorCode = "USER_201"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationId: string) {
        super(
            `Organization not found with ID: ${organizationId}`,
            HttpStatus.NOT_FOUND,
            {
                organizationId,
            },
        )
    }
}

export class OrganizationAlreadyExistsException extends BaseException {
    readonly errorCode = "USER_202"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(name: string) {
        super(
            `Organization with name '${name}' already exists`,
            HttpStatus.CONFLICT,
            {
                name,
            },
        )
    }
}

export class PendingOrganizationRequestException extends BaseException {
    readonly errorCode = "USER_203"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userId: string) {
        super(
            "User already has a pending organization request",
            HttpStatus.CONFLICT,
            { userId },
        )
    }
}

export class OrganizationNotPendingException extends BaseException {
    readonly errorCode = "USER_204"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationId: string, currentStatus: string) {
        super(
            `Organization ${organizationId} is not in pending status. Current status: ${currentStatus}`,
            HttpStatus.BAD_REQUEST,
            { organizationId, currentStatus },
        )
    }
}

export class UserAlreadyHasOrganizationException extends BaseException {
    readonly errorCode = "USER_205"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userId: string, organizationName: string) {
        super(
            `User is already a representative of organization: ${organizationName}`,
            HttpStatus.CONFLICT,
            { userId, organizationName },
        )
    }
}

// === ORGANIZATION MEMBERSHIP ERRORS ===
export class DuplicateJoinRequestException extends BaseException {
    readonly errorCode = "USER_301"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userId: string, organizationId: string) {
        super(
            "User already has a join request for this organization",
            HttpStatus.CONFLICT,
            { userId, organizationId },
        )
    }
}

export class UserAlreadyMemberException extends BaseException {
    readonly errorCode = "USER_302"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userId: string, organizationName: string) {
        super(
            `User is already a member of organization: ${organizationName}`,
            HttpStatus.CONFLICT,
            { userId, organizationName },
        )
    }
}

export class InvalidStaffRoleException extends BaseException {
    readonly errorCode = "USER_303"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(role: string) {
        super(
            `Invalid role for organization membership: ${role}. Only KITCHEN_STAFF and DELIVERY_STAFF are allowed`,
            HttpStatus.BAD_REQUEST,
            { role },
        )
    }
}

// === PROFILE ERRORS ===
export class ProfileNotFoundException extends BaseException {
    readonly errorCode = "USER_401"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(userId: string, profileType: string) {
        super(
            `${profileType} profile not found for user: ${userId}`,
            HttpStatus.NOT_FOUND,
            { userId, profileType },
        )
    }
}

export class InvalidRoleTransitionException extends BaseException {
    readonly errorCode = "USER_402"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(fromRole: string, toRole: string) {
        super(
            `Invalid role transition from ${fromRole} to ${toRole}`,
            HttpStatus.BAD_REQUEST,
            { fromRole, toRole },
        )
    }
}

// === DATA VALIDATION ERRORS ===
export class InvalidUserDataException extends BaseException {
    readonly errorCode = "USER_501"
    readonly errorType = "VALIDATION" as const
    readonly service = "user-service"

    constructor(field: string, reason: string) {
        super(`Invalid ${field}: ${reason}`, HttpStatus.BAD_REQUEST, {
            field,
            reason,
        })
    }
}

// === EXTERNAL SERVICE ERRORS ===
export class CognitoSyncFailedException extends BaseException {
    readonly errorCode = "USER_601"
    readonly errorType = "EXTERNAL" as const
    readonly service = "user-service"

    constructor(userId: string, operation: string, details?: string) {
        super(
            `Failed to sync user ${userId} with AWS Cognito during ${operation}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            { userId, operation, details },
        )
    }
}

export class DatabaseOperationException extends BaseException {
    readonly errorCode = "USER_602"
    readonly errorType = "EXTERNAL" as const
    readonly service = "user-service"

    constructor(operation: string, details?: string) {
        super(
            `Database operation failed: ${operation}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            { operation, details },
        )
    }
}
