import { BadRequestException, NotFoundException } from "@nestjs/common"
import { CampaignStatus } from "../../enums/campaign/campaign.enum"

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
    constructor(status: CampaignStatus) {
        super(
            `Cannot delete campaign with status "${status}". ` +
                "Only campaigns with PENDING or REJECTED status can be deleted. " +
                "This protects campaigns that have received donations or are in progress.",
        )
    }
}
