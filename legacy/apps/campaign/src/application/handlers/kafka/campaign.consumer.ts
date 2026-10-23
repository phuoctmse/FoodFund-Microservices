import { Controller, Logger } from "@nestjs/common"
import { EventPattern, Payload } from "@nestjs/microservices"
import { CampaignSearchService } from "../../services/campaign/campaign-search.service"
import { CampaignRepository } from "../../repositories/campaign.repository"

@Controller()
export class CampaignConsumer {
    private readonly logger = new Logger(CampaignConsumer.name)

    constructor(
        private readonly searchService: CampaignSearchService,
        private readonly campaignRepository: CampaignRepository,
    ) { }

    @EventPattern("foodfund_campaign.public.campaigns")
    async handleCampaignChange(@Payload() message: any) {
        try {
            this.logger.debug(`Received Kafka message keys: ${Object.keys(message || {})}`)
            const payload = message.payload || message

            if (!payload || !payload.op) {
                this.logger.warn("Invalid payload structure: missing 'op' field", payload)
                return
            }

            const { op, after, before } = payload

            this.logger.debug(`Received CDC event: ${op} for campaign ${after?.id || before?.id}`)

            switch (op) {
            case "c": // Create
            case "r": // Read (Snapshot)
            case "u": // Update
                if (after && after.id) {
                    const campaign = await this.campaignRepository.findById(after.id)
                    if (campaign) {
                        await this.searchService.indexCampaign(campaign)
                    }
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
