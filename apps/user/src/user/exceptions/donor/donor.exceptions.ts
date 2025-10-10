import { HttpStatus } from "@nestjs/common"
import { BaseException } from "libs/exceptions"

// === DONOR SPECIFIC EXCEPTIONS ===

// Donor authorization errors
export class DonorOnlyOperationException extends BaseException {
    readonly errorCode = "DONOR_101"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(operation: string) {
        super(
            `Operation '${operation}' can only be performed by donors`,
            HttpStatus.FORBIDDEN,
            { operation }
        )
    }
}

export class DonorProfileIncompleteException extends BaseException {
    readonly errorCode = "DONOR_102"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(missingFields: string[]) {
        super(
            `Donor profile incomplete. Missing fields: ${missingFields.join(", ")}`,
            HttpStatus.BAD_REQUEST,
            { missingFields }
        )
    }
}

// Organization request errors
export class DonorAlreadyHasOrganizationRequestException extends BaseException {
    readonly errorCode = "DONOR_201"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, requestStatus: string) {
        super(
            `Donor already has an organization request with status: ${requestStatus}`,
            HttpStatus.CONFLICT,
            { donorId, requestStatus }
        )
    }
}

export class CannotCreateOrganizationAsNonDonorException extends BaseException {
    readonly errorCode = "DONOR_202"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(currentRole: string) {
        super(
            `Cannot create organization request. Current role: ${currentRole}. Only donors can create organization requests`,
            HttpStatus.FORBIDDEN,
            { currentRole }
        )
    }
}

export class OrganizationRequestPendingException extends BaseException {
    readonly errorCode = "DONOR_203"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string) {
        super(
            "Cannot perform this action while organization request is pending approval",
            HttpStatus.CONFLICT,
            { donorId }
        )
    }
}

// Join organization errors
export class DonorAlreadyHasJoinRequestException extends BaseException {
    readonly errorCode = "DONOR_301"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, organizationName: string, requestStatus: string) {
        super(
            `Donor already has a join request for '${organizationName}' with status: ${requestStatus}`,
            HttpStatus.CONFLICT,
            { donorId, organizationName, requestStatus }
        )
    }
}

export class CannotJoinOwnOrganizationException extends BaseException {
    readonly errorCode = "DONOR_302"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, organizationName: string) {
        super(
            `Cannot join organization '${organizationName}' as you are its representative`,
            HttpStatus.FORBIDDEN,
            { donorId, organizationName }
        )
    }
}

export class CannotJoinAsNonDonorException extends BaseException {
    readonly errorCode = "DONOR_303"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(currentRole: string) {
        super(
            `Cannot join organization. Current role: ${currentRole}. Only donors can join organizations as staff`,
            HttpStatus.FORBIDDEN,
            { currentRole }
        )
    }
}

export class JoinRequestLimitExceededException extends BaseException {
    readonly errorCode = "DONOR_304"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, maxAllowed: number) {
        super(
            `Maximum join request limit (${maxAllowed}) exceeded`,
            HttpStatus.BAD_REQUEST,
            { donorId, maxAllowed }
        )
    }
}

export class NoJoinRequestToCancel extends BaseException {
    readonly errorCode = "DONOR_305"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string) {
        super(
            "No pending join request found to cancel",
            HttpStatus.NOT_FOUND,
            { donorId }
        )
    }
}

export class JoinRequestNotCancellableException extends BaseException {
    readonly errorCode = "DONOR_306"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(requestId: string, currentStatus: string) {
        super(
            `Join request ${requestId} cannot be cancelled. Current status: ${currentStatus}`,
            HttpStatus.BAD_REQUEST,
            { requestId, currentStatus }
        )
    }
}

// Donation errors (if applicable)
export class InsufficientDonationAmountException extends BaseException {
    readonly errorCode = "DONOR_401"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(amount: number, minimumRequired: number) {
        super(
            `Donation amount ${amount} is below minimum required: ${minimumRequired}`,
            HttpStatus.BAD_REQUEST,
            { amount, minimumRequired }
        )
    }
}

export class DonationLimitExceededException extends BaseException {
    readonly errorCode = "DONOR_402"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(amount: number, dailyLimit: number, currentDailyTotal: number) {
        super(
            `Donation amount ${amount} would exceed daily limit. Daily limit: ${dailyLimit}, Current total: ${currentDailyTotal}`,
            HttpStatus.BAD_REQUEST,
            { amount, dailyLimit, currentDailyTotal }
        )
    }
}

export class CampaignNotAcceptingDonationsException extends BaseException {
    readonly errorCode = "DONOR_403"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(campaignId: string, reason: string) {
        super(
            `Campaign ${campaignId} is not accepting donations: ${reason}`,
            HttpStatus.BAD_REQUEST,
            { campaignId, reason }
        )
    }
}

// Profile and account errors
export class ProfileUpdateRestrictedException extends BaseException {
    readonly errorCode = "DONOR_501"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(field: string, reason: string) {
        super(
            `Cannot update ${field}: ${reason}`,
            HttpStatus.FORBIDDEN,
            { field, reason }
        )
    }
}

export class AccountDeactivatedException extends BaseException {
    readonly errorCode = "DONOR_502"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, reason: string) {
        super(
            `Account is deactivated: ${reason}`,
            HttpStatus.FORBIDDEN,
            { donorId, reason }
        )
    }
}

export class VerificationRequiredException extends BaseException {
    readonly errorCode = "DONOR_503"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(verificationType: string, operation: string) {
        super(
            `${verificationType} verification required to perform operation: ${operation}`,
            HttpStatus.FORBIDDEN,
            { verificationType, operation }
        )
    }
}

// History and tracking errors
export class DonationHistoryNotFoundException extends BaseException {
    readonly errorCode = "DONOR_601"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(donorId: string, timeRange: string) {
        super(
            `No donation history found for time range: ${timeRange}`,
            HttpStatus.NOT_FOUND,
            { donorId, timeRange }
        )
    }
}

export class InvalidDateRangeException extends BaseException {
    readonly errorCode = "DONOR_602"
    readonly errorType = "BUSINESS" as const
    readonly service = "user-service"

    constructor(startDate: string, endDate: string) {
        super(
            `Invalid date range: start date (${startDate}) must be before end date (${endDate})`,
            HttpStatus.BAD_REQUEST,
            { startDate, endDate }
        )
    }
}