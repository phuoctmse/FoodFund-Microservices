import { Controller, Logger } from "@nestjs/common"
import { EventPattern, Payload } from "@nestjs/microservices"
import { WalletTransactionSearchService } from "../../services/wallet/wallet-transaction-search.service"

@Controller()
export class WalletTransactionConsumer {
    private readonly logger = new Logger(WalletTransactionConsumer.name)

    constructor(
        private readonly searchService: WalletTransactionSearchService,
    ) { }

    @EventPattern("foodfund_users.public.wallet_transactions")
    async handleTransactionChange(@Payload() message: any) {
        try {
            // Debezium message structure: { payload: { before: ..., after: ..., op: ... } }
            // Or sometimes just { before: ..., after: ..., op: ... } depending on converter config
            // We'll assume the standard JSON converter structure where the value is the payload

            const payload = message

            if (!payload || !payload.op) {
                // Sometimes heartbeat messages or schema changes come through
                return
            }

            const { op, after, before } = payload

            this.logger.debug(`Received CDC event: ${op} for transaction ${after?.id || before?.id}`)

            switch (op) {
            case "c": // Create
            case "r": // Read (Snapshot)
            case "u": // Update
                if (after) {
                    await this.searchService.indexTransaction(after)
                }
                break
            case "d": // Delete
                // We don't have a delete method in search service yet, but usually we just remove from index
                // For now, we'll log it. If needed, we can add removeTransaction to the service.
                this.logger.warn(`Delete operation received for transaction ${before?.id} - Not implemented yet`)
                break
            default:
                break
            }
        } catch (error) {
            this.logger.error("Error processing wallet transaction CDC event", error)
        }
    }
}
