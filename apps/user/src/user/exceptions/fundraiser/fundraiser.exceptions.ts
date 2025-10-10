import { HttpStatus } from "@nestjs/common"
import { BaseException } from "libs/exceptions"

// === FUNDRAISER SPECIFIC EXCEPTIONS ===

// Fundraiser authorization errors
export class FundraiserOnlyOperationException extends BaseException {
    readonly errorCode = "FUNDRAISER_101"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Operation '${operation}' can only be performed by fundraisers`,
            HttpStatus.FORBIDDEN,
            { operation }
        )
    }
}

export class NotOrganizationRepresentativeException extends BaseException {
    readonly errorCode = "FUNDRAISER_102"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(fundraiserId: string, organizationName: string) {
        super(
            `User is not the representative of organization: ${organizationName}`,
            HttpStatus.FORBIDDEN,
            { fundraiserId, organizationName }
        )
    }
}

// Organization management errors
export class FundraiserHasNoOrganizationException extends BaseException {
    readonly errorCode = "FUNDRAISER_201"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(fundraiserId: string) {
        super(
            "Fundraiser does not have an associated organization",
            HttpStatus.BAD_REQUEST,
            { fundraiserId }
        )
    }
}

export class OrganizationNotActiveException extends BaseException {
    readonly errorCode = "FUNDRAISER_202"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationId: string, currentStatus: string) {
        super(
            `Organization is not active. Current status: ${currentStatus}`,
            HttpStatus.BAD_REQUEST,
            { organizationId, currentStatus }
        )
    }
}

export class OrganizationSuspendedException extends BaseException {
    readonly errorCode = "FUNDRAISER_203"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationName: string, reason: string) {
        super(
            `Organization '${organizationName}' is suspended: ${reason}`,
            HttpStatus.FORBIDDEN,
            { organizationName, reason }
        )
    }
}

// Staff management errors
export class JoinRequestNotFoundException extends BaseException {
    readonly errorCode = "FUNDRAISER_301"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string) {
        super(
            `Join request not found with ID: ${requestId}`,
            HttpStatus.NOT_FOUND,
            { requestId }
        )
    }
}

export class JoinRequestNotPendingException extends BaseException {
    readonly errorCode = "FUNDRAISER_302"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string, currentStatus: string) {
        super(
            `Join request ${requestId} is not pending. Current status: ${currentStatus}`,
            HttpStatus.BAD_REQUEST,
            { requestId, currentStatus }
        )
    }
}

export class JoinRequestNotForYourOrganizationException extends BaseException {
    readonly errorCode = "FUNDRAISER_303"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string, requestOrgName: string, userOrgName: string) {
        super(
            `Join request ${requestId} is for '${requestOrgName}', but you manage '${userOrgName}'`,
            HttpStatus.FORBIDDEN,
            { requestId, requestOrgName, userOrgName }
        )
    }
}

export class MaximumStaffLimitReachedException extends BaseException {
    readonly errorCode = "FUNDRAISER_304"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationName: string, role: string, maxLimit: number) {
        super(
            `Maximum ${role} limit (${maxLimit}) reached for organization: ${organizationName}`,
            HttpStatus.BAD_REQUEST,
            { organizationName, role, maxLimit }
        )
    }
}

export class CannotRemoveActiveStaffException extends BaseException {
    readonly errorCode = "FUNDRAISER_305"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(staffId: string, reason: string) {
        super(
            `Cannot remove staff member ${staffId}: ${reason}`,
            HttpStatus.BAD_REQUEST,
            { staffId, reason }
        )
    }
}

// Campaign management errors (if applicable)
export class CampaignQuotaExceededException extends BaseException {
    readonly errorCode = "FUNDRAISER_401"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationName: string, currentCount: number, maxAllowed: number) {
        super(
            `Campaign quota exceeded for '${organizationName}'. Current: ${currentCount}, Max: ${maxAllowed}`,
            HttpStatus.BAD_REQUEST,
            { organizationName, currentCount, maxAllowed }
        )
    }
}

export class InsufficientFundsException extends BaseException {
    readonly errorCode = "FUNDRAISER_402"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(organizationName: string, requiredAmount: number, availableAmount: number) {
        super(
            `Insufficient funds for operation. Required: ${requiredAmount}, Available: ${availableAmount}`,
            HttpStatus.BAD_REQUEST,
            { organizationName, requiredAmount, availableAmount }
        )
    }
}

// Compliance and reporting errors
export class ReportGenerationFailedException extends BaseException {
    readonly errorCode = "FUNDRAISER_501"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(reportType: string, reason: string) {
        super(
            `Failed to generate ${reportType} report: ${reason}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            { reportType, reason }
        )
    }
}

export class MissingRequiredDocumentationException extends BaseException {
    readonly errorCode = "FUNDRAISER_502"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(documentType: string, operation: string) {
        super(
            `Missing required ${documentType} documentation for operation: ${operation}`,
            HttpStatus.BAD_REQUEST,
            { documentType, operation }
        )
    }
}

export class ComplianceViolationException extends BaseException {
    readonly errorCode = "FUNDRAISER_503"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(violationType: string, description: string) {
        super(
            `Compliance violation (${violationType}): ${description}`,
            HttpStatus.FORBIDDEN,
            { violationType, description }
        )
    }
}