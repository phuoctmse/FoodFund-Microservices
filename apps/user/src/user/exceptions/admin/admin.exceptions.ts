import { HttpStatus } from "@nestjs/common"
import { BaseException } from "libs/exceptions"

// === ADMIN SPECIFIC EXCEPTIONS ===

// Admin authorization errors
export class AdminOnlyOperationException extends BaseException {
    readonly errorCode = "ADMIN_101"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Operation '${operation}' can only be performed by administrators`,
            HttpStatus.FORBIDDEN,
            { operation }
        )
    }
}

export class InsufficientAdminPrivilegeException extends BaseException {
    readonly errorCode = "ADMIN_102"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requiredPrivilege: string, operation: string) {
        super(
            `Operation '${operation}' requires '${requiredPrivilege}' privilege`,
            HttpStatus.FORBIDDEN,
            { requiredPrivilege, operation }
        )
    }
}

// Organization request management errors
export class OrganizationRequestNotFoundException extends BaseException {
    readonly errorCode = "ADMIN_201"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string) {
        super(
            `Organization request not found with ID: ${requestId}`,
            HttpStatus.NOT_FOUND,
            { requestId }
        )
    }
}

export class OrganizationRequestNotPendingException extends BaseException {
    readonly errorCode = "ADMIN_202"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string, currentStatus: string) {
        super(
            `Organization request ${requestId} is not pending. Current status: ${currentStatus}`,
            HttpStatus.BAD_REQUEST,
            { requestId, currentStatus }
        )
    }
}

export class OrganizationRequestAlreadyProcessedException extends BaseException {
    readonly errorCode = "ADMIN_203"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string, processedStatus: string, processedBy: string) {
        super(
            `Organization request ${requestId} was already ${processedStatus} by ${processedBy}`,
            HttpStatus.CONFLICT,
            { requestId, processedStatus, processedBy }
        )
    }
}

// User management errors
export class CannotModifySuperAdminException extends BaseException {
    readonly errorCode = "ADMIN_301"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Cannot ${operation} super administrator account`,
            HttpStatus.FORBIDDEN,
            { operation }
        )
    }
}

export class CannotModifyOwnAccountException extends BaseException {
    readonly errorCode = "ADMIN_302"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Administrators cannot ${operation} their own account`,
            HttpStatus.FORBIDDEN,
            { operation }
        )
    }
}

export class BulkOperationFailedException extends BaseException {
    readonly errorCode = "ADMIN_303"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string, successCount: number, failureCount: number, errors: string[]) {
        super(
            `Bulk ${operation} completed with ${successCount} successes and ${failureCount} failures`,
            HttpStatus.PARTIAL_CONTENT,
            { operation, successCount, failureCount, errors }
        )
    }
}

// System management errors
export class SystemConfigurationException extends BaseException {
    readonly errorCode = "ADMIN_401"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(configKey: string, reason: string) {
        super(
            `System configuration error for '${configKey}': ${reason}`,
            HttpStatus.BAD_REQUEST,
            { configKey, reason }
        )
    }
}

export class MaintenanceModeException extends BaseException {
    readonly errorCode = "ADMIN_402"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Operation '${operation}' is not available during maintenance mode`,
            HttpStatus.SERVICE_UNAVAILABLE,
            { operation }
        )
    }
}

// Audit and compliance errors
export class AuditLogNotFoundException extends BaseException {
    readonly errorCode = "ADMIN_501"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(logId: string) {
        super(
            `Audit log not found with ID: ${logId}`,
            HttpStatus.NOT_FOUND,
            { logId }
        )
    }
}

export class DataRetentionPolicyViolationException extends BaseException {
    readonly errorCode = "ADMIN_502"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string, retentionPeriod: string) {
        super(
            `Operation '${operation}' violates data retention policy (${retentionPeriod})`,
            HttpStatus.FORBIDDEN,
            { operation, retentionPeriod }
        )
    }
}