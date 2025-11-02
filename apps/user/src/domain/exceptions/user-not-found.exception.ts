import { NotFoundException } from "@nestjs/common"

/**
 * Domain Exception: User Not Found
 */
export class UserNotFoundException extends NotFoundException {
    constructor(identifier: string) {
        super(`User not found: ${identifier}`)
    }
}
