import { UnauthorizedException } from "@nestjs/common"

/**
 * Domain Exception: User Inactive
 * Thrown when user account is deactivated
 */
export class UserInactiveException extends UnauthorizedException {
    constructor(email: string) {
        super(
            `Your account (${email}) has been deactivated. Please contact support for assistance.`,
        )
    }
}
