import { NotFoundException } from "@nestjs/common"

/**
 * Domain Exception: Organization Not Found
 */
export class OrganizationNotFoundException extends NotFoundException {
    constructor(identifier: string) {
        super(`Organization not found: ${identifier}`)
    }
}
