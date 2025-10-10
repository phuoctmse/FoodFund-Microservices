import {
    FundraiserOnlyOperationException,
    NotOrganizationRepresentativeException,
    FundraiserHasNoOrganizationException,
    OrganizationNotActiveException,
    OrganizationSuspendedException,
    JoinRequestNotFoundException,
    JoinRequestNotPendingException,
    JoinRequestNotForYourOrganizationException,
    MaximumStaffLimitReachedException,
    CannotRemoveActiveStaffException,
    CampaignQuotaExceededException,
    InsufficientFundsException,
    ReportGenerationFailedException,
    MissingRequiredDocumentationException,
    ComplianceViolationException,
} from "./fundraiser.exceptions"

export class FundraiserErrorHelper {
    // Authorization helpers
    static throwFundraiserOnlyOperation(operation: string): never {
        throw new FundraiserOnlyOperationException(operation)
    }

    static throwNotOrganizationRepresentative(fundraiserId: string, organizationName: string): never {
        throw new NotOrganizationRepresentativeException(fundraiserId, organizationName)
    }

    // Organization management helpers
    static throwFundraiserHasNoOrganization(fundraiserId: string): never {
        throw new FundraiserHasNoOrganizationException(fundraiserId)
    }

    static throwOrganizationNotActive(organizationId: string, currentStatus: string): never {
        throw new OrganizationNotActiveException(organizationId, currentStatus)
    }

    static throwOrganizationSuspended(organizationName: string, reason: string): never {
        throw new OrganizationSuspendedException(organizationName, reason)
    }

    // Staff management helpers
    static throwJoinRequestNotFound(requestId: string): never {
        throw new JoinRequestNotFoundException(requestId)
    }

    static throwJoinRequestNotPending(requestId: string, currentStatus: string): never {
        throw new JoinRequestNotPendingException(requestId, currentStatus)
    }

    static throwJoinRequestNotForYourOrganization(
        requestId: string,
        requestOrgName: string,
        userOrgName: string
    ): never {
        throw new JoinRequestNotForYourOrganizationException(requestId, requestOrgName, userOrgName)
    }

    static throwMaximumStaffLimitReached(organizationName: string, role: string, maxLimit: number): never {
        throw new MaximumStaffLimitReachedException(organizationName, role, maxLimit)
    }

    static throwCannotRemoveActiveStaff(staffId: string, reason: string): never {
        throw new CannotRemoveActiveStaffException(staffId, reason)
    }

    // Campaign management helpers
    static throwCampaignQuotaExceeded(
        organizationName: string,
        currentCount: number,
        maxAllowed: number
    ): never {
        throw new CampaignQuotaExceededException(organizationName, currentCount, maxAllowed)
    }

    static throwInsufficientFunds(
        organizationName: string,
        requiredAmount: number,
        availableAmount: number
    ): never {
        throw new InsufficientFundsException(organizationName, requiredAmount, availableAmount)
    }

    // Compliance and reporting helpers
    static throwReportGenerationFailed(reportType: string, reason: string): never {
        throw new ReportGenerationFailedException(reportType, reason)
    }

    static throwMissingRequiredDocumentation(documentType: string, operation: string): never {
        throw new MissingRequiredDocumentationException(documentType, operation)
    }

    static throwComplianceViolation(violationType: string, description: string): never {
        throw new ComplianceViolationException(violationType, description)
    }
}