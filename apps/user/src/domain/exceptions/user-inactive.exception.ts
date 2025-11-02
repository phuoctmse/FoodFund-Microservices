import { UnauthorizedException } from "@nestjs/common"

/**
 * Domain Exception: User Inactive
 */
export class UserInactiveException extends UnauthorizedException {
    constructor(userId: string) {
        super(`User account is inactive: ${userId}`)
    }
}
