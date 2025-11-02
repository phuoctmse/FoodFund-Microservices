import { BadRequestException } from "@nestjs/common"

/**
 * Domain Exception: Join Request Already Exists
 * Thrown when user tries to join organization but already has a request
 */
export class JoinRequestExistsException extends BadRequestException {
    constructor(userId: string) {
        super(
            `User ${userId} already has a pending join request or membership. Please wait for the current request to be processed or leave your current organization before joining a new one.`,
        )
    }
}
