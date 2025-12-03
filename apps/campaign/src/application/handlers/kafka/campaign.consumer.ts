import { Controller, Logger } from "@nestjs/common"
import { EventPattern, Payload } from "@nestjs/microservices"
import { CampaignSearchService } from "../../services/campaign/campaign-search.service"

@Controller()
export class CampaignConsumer {
    private readonly logger = new Logger(CampaignConsumer.name)

    constructor(
        private readonly searchService: CampaignSearchService,
    ) { }

    @EventPattern("foodfund_campaign.public.campaigns")
    async handleCampaignChange(@Payload() message: any) {
        try {
            const payload = message

            if (!payload || !payload.op) {
                return
            }

            const { op, after, before } = payload

            this.logger.debug(`Received CDC event: ${op} for campaign ${after?.id || before?.id}`)

            switch (op) {
            case "c": // Create
            case "r": // Read (Snapshot)
            case "u": // Update
                if (after) {
                    await this.searchService.indexCampaign(after)
                }
                break
            case "d": // Delete
                if (before && before.id) {
                    await this.searchService.removeCampaign(before.id)
                }
                break
            default:
                break
            }
        } catch (error) {
            this.logger.error("Error processing campaign CDC event", error)
        }
    }
}
