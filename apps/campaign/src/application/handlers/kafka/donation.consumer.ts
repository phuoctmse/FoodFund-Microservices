import { Controller, Logger } from "@nestjs/common"
import { EventPattern, Payload } from "@nestjs/microservices"
import { DonationSearchService } from "../../services/donation/donation-search.service"
import { DonorRepository } from "../../repositories/donor.repository"

@Controller()
export class DonationConsumer {
    private readonly logger = new Logger(DonationConsumer.name)

    constructor(
        private readonly searchService: DonationSearchService,
        private readonly donorRepository: DonorRepository,
    ) { }

    @EventPattern("foodfund_campaign.public.donations")
    async handleDonationChange(@Payload() message: any) {
        try {
            this.logger.debug(`Received Kafka message keys: ${Object.keys(message || {})}`)
            const payload = message.payload || message
            if (!payload || !payload.op) return

            const { op, after, before } = payload
            const id = after?.id || before?.id

            this.logger.debug(`Received CDC event: ${op} for donation ${id}`)

            if (op === "d") {
                // Handle delete if needed, usually we might just remove from index
                // But for now, let's just log it
                this.logger.warn(`Delete operation for donation ${id} - Not implemented`)
                return
            }

            // For Create and Update, we fetch the full donation with relations
            if (id) {
                const donation = await this.donorRepository.findById(id)
                if (donation) {
                    await this.searchService.indexDonation(donation)
                } else {
                    this.logger.warn(`Donation ${id} not found in DB after CDC event`)
                }
            }
        } catch (error) {
            this.logger.error("Error processing donation CDC event", error)
        }
    }

    @EventPattern("foodfund_campaign.public.payment_transactions")
    async handleTransactionChange(@Payload() message: any) {
        try {
            this.logger.debug(`Received Kafka message keys: ${Object.keys(message || {})}`)
            const payload = message.payload || message
            if (!payload || !payload.op) return

            const { op, after, before } = payload
            const donationId = after?.donation_id || before?.donation_id

            this.logger.debug(`Received CDC event: ${op} for payment transaction linked to donation ${donationId}`)

            if (donationId) {
                // When a transaction changes, we re-index the parent donation
                // to update status, received amount, etc.
                const donation = await this.donorRepository.findById(donationId)
                if (donation) {
                    await this.searchService.indexDonation(donation)
                } else {
                    this.logger.warn(`Donation ${donationId} not found in DB after transaction CDC event`)
                }
            }
        } catch (error) {
            this.logger.error("Error processing payment transaction CDC event", error)
        }
    }
}
