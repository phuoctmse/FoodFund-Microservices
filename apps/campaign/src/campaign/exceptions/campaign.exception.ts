import { BadRequestException, NotFoundException } from "@nestjs/common"

export class CampaignNotFoundException extends NotFoundException {
    constructor(id: string) {
        super(`Campaign with ID ${id} not found`)
    }
}

export class CampaignValidationException extends BadRequestException {
    constructor(field: string, reason: string) {
        super(`Campaign validation failed for ${field}: ${reason}`)
    }
}

export class CampaignCannotBeDeletedException extends BadRequestException {
    constructor(status: string) {
        super(
            `Cannot delete campaign with status ${status}. Only campaigns with PENDING status can be deleted.`,
        )
    }
}
