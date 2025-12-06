import {
    MissingRequiredFieldException,
    InvalidTokenException,
} from "libs/exceptions"
import {
    UserNotFoundException,
    UserAlreadyExistsException,
    UnauthorizedRoleException,
    OrganizationNotFoundException,
    OrganizationAlreadyExistsException,
    PendingOrganizationRequestException,
    OrganizationNotPendingException,
    UserAlreadyHasOrganizationException,
    DuplicateJoinRequestException,
    UserAlreadyMemberException,
    InvalidStaffRoleException,
    ProfileNotFoundException,
    InvalidRoleTransitionException,
    InvalidUserDataException,
    CognitoSyncFailedException,
    DatabaseOperationException,
} from "./user.exceptions"

export class UserErrorHelper {
    // User validation helpers
    static throwUserNotFound(
        identifier: string,
        searchBy: string = "id",
    ): never {
        throw new UserNotFoundException(identifier, searchBy)
    }

    static throwUserAlreadyExists(field: string, value: string): never {
        throw new UserAlreadyExistsException(field, value)
    }

    static throwUnauthorizedRole(
        userRole: string,
        requiredRoles: string[],
    ): never {
        throw new UnauthorizedRoleException(userRole, requiredRoles)
    }

    static throwMissingField(fieldName: string): never {
        throw new MissingRequiredFieldException(fieldName)
    }

    static throwInvalidUserData(field: string, reason: string): never {
        throw new InvalidUserDataException(field, reason)
    }

    // Organization helpers
    static throwOrganizationNotFound(organizationId: string): never {
        throw new OrganizationNotFoundException(organizationId)
    }

    static throwOrganizationAlreadyExists(name: string): never {
        throw new OrganizationAlreadyExistsException(name)
    }

    static throwPendingOrganizationRequest(userId: string): never {
        throw new PendingOrganizationRequestException(userId)
    }

    static throwOrganizationNotPending(
        organizationId: string,
        currentStatus: string,
    ): never {
        throw new OrganizationNotPendingException(organizationId, currentStatus)
    }

    static throwUserAlreadyHasOrganization(
        userId: string,
        organizationName: string,
    ): never {
        throw new UserAlreadyHasOrganizationException(userId, organizationName)
    }

    // Organization membership helpers
    static throwDuplicateJoinRequest(
        userId: string,
        organizationId: string,
    ): never {
        throw new DuplicateJoinRequestException(userId, organizationId)
    }

    static throwUserAlreadyMember(
        userId: string,
        organizationName: string,
    ): never {
        throw new UserAlreadyMemberException(userId, organizationName)
    }

    static throwInvalidStaffRole(role: string): never {
        throw new InvalidStaffRoleException(role)
    }

    // Profile helpers
    static throwProfileNotFound(userId: string, profileType: string): never {
        throw new ProfileNotFoundException(userId, profileType)
    }

    static throwInvalidRoleTransition(fromRole: string, toRole: string): never {
        throw new InvalidRoleTransitionException(fromRole, toRole)
    }

    // External service helpers
    static throwCognitoSyncFailed(
        userId: string,
        operation: string,
        details?: string,
    ): never {
        throw new CognitoSyncFailedException(userId, operation, details)
    }

    static throwDatabaseOperationFailed(
        operation: string,
        details?: string,
    ): never {
        throw new DatabaseOperationException(operation, details)
    }

    static throwInvalidToken(reason?: string): never {
        throw new InvalidTokenException(reason || "Invalid token provided")
    }

    // Validation helpers for common cases
    static validateCognitoId(cognitoId: string): void {
        if (!cognitoId || cognitoId.trim().length === 0) {
            this.throwMissingField("cognito_id")
        }
    }

    static validateEmail(email: string): void {
        if (!email || email.trim().length === 0) {
            this.throwMissingField("email")
        }

        const emailRegex =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
        if (!emailRegex.test(email)) {
            this.throwInvalidUserData("email", "Invalid email format")
        }
    }

    static validateRequiredString(value: string, fieldName: string): void {
        if (!value || value.trim().length === 0) {
            this.throwMissingField(fieldName)
        }
    }

    static validateJoinOrganizationRole(role: string): void {
        const validJoinRoles = ["KITCHEN_STAFF", "DELIVERY_STAFF", "FUNDRAISER"]
        if (!validJoinRoles.includes(role)) {
            this.throwInvalidUserData(
                "requested_role",
                `Invalid role for organization membership: ${role}. Valid roles are: ${validJoinRoles.join(", ")}`,
            )
        }
    }

    static validateStaffRole(role: string): void {
        const validStaffRoles = ["KITCHEN_STAFF", "DELIVERY_STAFF"]
        if (!validStaffRoles.includes(role)) {
            this.throwInvalidStaffRole(role)
        }
    }

    static validateRoleTransition(fromRole: string, toRole: string): void {
        const validTransitions = {
            DONOR: ["FUNDRAISER"],
            // Add more valid transitions as needed
        }

        const allowedToRoles =
            validTransitions[fromRole as keyof typeof validTransitions]
        if (!allowedToRoles?.includes(toRole)) {
            this.throwInvalidRoleTransition(fromRole, toRole)
        }
    }

    // Helper to handle Prisma errors
    static handlePrismaError(error: any, operation: string): never {
        if (error.code === "P2002") {
            // Unique constraint violation
            const field = error.meta?.target?.[0] || "field"
            this.throwUserAlreadyExists(field, "value")
        }

        if (error.code === "P2025") {
            // Record not found
            this.throwUserNotFound("unknown", "query")
        }

        // Default to database operation error
        this.throwDatabaseOperationFailed(operation, error.message)
    }
}
