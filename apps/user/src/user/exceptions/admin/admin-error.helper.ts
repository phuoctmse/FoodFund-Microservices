import {
    AdminOnlyOperationException,
    InsufficientAdminPrivilegeException,
    OrganizationRequestNotFoundException,
    OrganizationRequestNotPendingException,
    OrganizationRequestAlreadyProcessedException,
    CannotModifySuperAdminException,
    CannotModifyOwnAccountException,
    BulkOperationFailedException,
    SystemConfigurationException,
    MaintenanceModeException,
    AuditLogNotFoundException,
    DataRetentionPolicyViolationException,
} from "./admin.exceptions"

export class AdminErrorHelper {
    // Authorization helpers
    static throwAdminOnlyOperation(operation: string): never {
        throw new AdminOnlyOperationException(operation)
    }

    static throwInsufficientPrivilege(requiredPrivilege: string, operation: string): never {
        throw new InsufficientAdminPrivilegeException(requiredPrivilege, operation)
    }

    // Organization request management helpers
    static throwOrganizationRequestNotFound(requestId: string): never {
        throw new OrganizationRequestNotFoundException(requestId)
    }

    static throwOrganizationRequestNotPending(requestId: string, currentStatus: string): never {
        throw new OrganizationRequestNotPendingException(requestId, currentStatus)
    }

    static throwOrganizationRequestAlreadyProcessed(
        requestId: string,
        processedStatus: string,
        processedBy: string
    ): never {
        throw new OrganizationRequestAlreadyProcessedException(requestId, processedStatus, processedBy)
    }

    // User management helpers
    static throwCannotModifySuperAdmin(operation: string): never {
        throw new CannotModifySuperAdminException(operation)
    }

    static throwCannotModifyOwnAccount(operation: string): never {
        throw new CannotModifyOwnAccountException(operation)
    }

    static throwBulkOperationFailed(
        operation: string,
        successCount: number,
        failureCount: number,
        errors: string[]
    ): never {
        throw new BulkOperationFailedException(operation, successCount, failureCount, errors)
    }

    // System management helpers
    static throwSystemConfigurationError(configKey: string, reason: string): never {
        throw new SystemConfigurationException(configKey, reason)
    }

    static throwMaintenanceModeError(operation: string): never {
        throw new MaintenanceModeException(operation)
    }

    // Audit and compliance helpers
    static throwAuditLogNotFound(logId: string): never {
        throw new AuditLogNotFoundException(logId)
    }

    static throwDataRetentionPolicyViolation(operation: string, retentionPeriod: string): never {
        throw new DataRetentionPolicyViolationException(operation, retentionPeriod)
    }
}