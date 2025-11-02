import { BadRequestException } from "@nestjs/common"

/**
 * Domain Exception: Organization Already Exists
 * Thrown when user tries to create organization but already has one
 */
export class OrganizationAlreadyExistsException extends BadRequestException {
    constructor(userId: string) {
        super(
            `User ${userId} already has a pending organization request. Please wait for approval or cancel the existing request.`,
        )
    }
}
