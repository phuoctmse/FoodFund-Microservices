import {
    DonorOnlyOperationException,
    DonorProfileIncompleteException,
    DonorAlreadyHasOrganizationRequestException,
    CannotCreateOrganizationAsNonDonorException,
    OrganizationRequestPendingException,
    DonorAlreadyHasJoinRequestException,
    CannotJoinOwnOrganizationException,
    CannotJoinAsNonDonorException,
    JoinRequestLimitExceededException,
    NoJoinRequestToCancel,
    JoinRequestNotCancellableException,
    InsufficientDonationAmountException,
    DonationLimitExceededException,
    CampaignNotAcceptingDonationsException,
    ProfileUpdateRestrictedException,
    AccountDeactivatedException,
    VerificationRequiredException,
    DonationHistoryNotFoundException,
    InvalidDateRangeException,
} from "./donor.exceptions"

export class DonorErrorHelper {
    // Authorization helpers
    static throwDonorOnlyOperation(operation: string): never {
        throw new DonorOnlyOperationException(operation)
    }

    static throwDonorProfileIncomplete(missingFields: string[]): never {
        throw new DonorProfileIncompleteException(missingFields)
    }

    // Organization request helpers
    static throwDonorAlreadyHasOrganizationRequest(
        donorId: string,
        requestStatus: string,
    ): never {
        throw new DonorAlreadyHasOrganizationRequestException(
            donorId,
            requestStatus,
        )
    }

    static throwCannotCreateOrganizationAsNonDonor(currentRole: string): never {
        throw new CannotCreateOrganizationAsNonDonorException(currentRole)
    }

    static throwOrganizationRequestPending(donorId: string): never {
        throw new OrganizationRequestPendingException(donorId)
    }

    // Join organization helpers
    static throwDonorAlreadyHasJoinRequest(
        donorId: string,
        organizationName: string,
        requestStatus: string,
    ): never {
        throw new DonorAlreadyHasJoinRequestException(
            donorId,
            organizationName,
            requestStatus,
        )
    }

    static throwCannotJoinOwnOrganization(
        donorId: string,
        organizationName: string,
    ): never {
        throw new CannotJoinOwnOrganizationException(donorId, organizationName)
    }

    static throwCannotJoinAsNonDonor(currentRole: string): never {
        throw new CannotJoinAsNonDonorException(currentRole)
    }

    static throwJoinRequestLimitExceeded(
        donorId: string,
        maxAllowed: number,
    ): never {
        throw new JoinRequestLimitExceededException(donorId, maxAllowed)
    }

    static throwNoJoinRequestToCancel(donorId: string): never {
        throw new NoJoinRequestToCancel(donorId)
    }

    static throwJoinRequestNotCancellable(
        requestId: string,
        currentStatus: string,
    ): never {
        throw new JoinRequestNotCancellableException(requestId, currentStatus)
    }

    // Donation helpers
    static throwInsufficientDonationAmount(
        amount: number,
        minimumRequired: number,
    ): never {
        throw new InsufficientDonationAmountException(amount, minimumRequired)
    }

    static throwDonationLimitExceeded(
        amount: number,
        dailyLimit: number,
        currentDailyTotal: number,
    ): never {
        throw new DonationLimitExceededException(
            amount,
            dailyLimit,
            currentDailyTotal,
        )
    }

    static throwCampaignNotAcceptingDonations(
        campaignId: string,
        reason: string,
    ): never {
        throw new CampaignNotAcceptingDonationsException(campaignId, reason)
    }

    // Profile and account helpers
    static throwProfileUpdateRestricted(field: string, reason: string): never {
        throw new ProfileUpdateRestrictedException(field, reason)
    }

    static throwAccountDeactivated(donorId: string, reason: string): never {
        throw new AccountDeactivatedException(donorId, reason)
    }

    static throwVerificationRequired(
        verificationType: string,
        operation: string,
    ): never {
        throw new VerificationRequiredException(verificationType, operation)
    }

    // History and tracking helpers
    static throwDonationHistoryNotFound(
        donorId: string,
        timeRange: string,
    ): never {
        throw new DonationHistoryNotFoundException(donorId, timeRange)
    }

    static throwInvalidDateRange(startDate: string, endDate: string): never {
        throw new InvalidDateRangeException(startDate, endDate)
    }
}
