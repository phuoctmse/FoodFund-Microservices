import { Injectable, Logger } from "@nestjs/common"
import { UserClientService } from "../../shared/services/user-client.service"
import { RedisService } from "@libs/redis"

interface SepayWebhookPayload {
    id: number // Sepay transaction ID
    gateway: string // Bank name (Vietcombank, MBBank, etc.)
    transactionDate: string // Transaction date
    accountNumber: string // Receiving account number
    code: string | null
    content: string // Transfer content/description
    transferType: string // "in" or "out"
    transferAmount: number // Amount transferred
    accumulated: number // Account balance after transfer
    subAccount: string | null
    referenceCode: string // Bank reference code (MBVCB.xxx)
    description: string
}

@Injectable()
export class SepayWebhookService {
    private readonly logger = new Logger(SepayWebhookService.name)

    constructor(
        private readonly userClientService: UserClientService,
        private readonly redisService: RedisService,
    ) {}

    /**
     * Handle Sepay webhook - Route ALL incoming transfers to Admin Wallet
     * NO matching logic - Sepay doesn't provide sender information
     */
    async handleSepayWebhook(payload: SepayWebhookPayload): Promise<void> {
        this.logger.log("[Sepay] Received webhook:", {
            id: payload.id,
            amount: payload.transferAmount,
            content: payload.content,
            referenceCode: payload.referenceCode,
            gateway: payload.gateway,
            transferType: payload.transferType,
        })

        // Only process incoming transfers
        if (payload.transferType !== "in") {
            this.logger.log(`[Sepay] Ignoring outgoing transfer: ${payload.id}`)
            return
        }

        // Check idempotency: Already processed?
        const isDuplicate = await this.checkIdempotency(
            payload.id,
            payload.referenceCode,
        )
        if (isDuplicate) {
            this.logger.log(`[Sepay] Duplicate webhook ignored: ${payload.id}`)
            return
        }

        // Route ALL incoming transfers to Admin Wallet
        // Admin will handle refunds/reviews manually if needed
        await this.routeToAdminWallet(payload)
    }

    /**
     * Route incoming transfer to Admin Wallet (giữ luôn, no matching)
     */
    private async routeToAdminWallet(
        payload: SepayWebhookPayload,
    ): Promise<void> {
        try {
            // Get system admin ID from environment
            const adminUserId = this.getSystemAdminId()

            this.logger.log(
                `[Sepay] Routing to Admin Wallet - Admin ID: ${adminUserId}`,
            )

            // Credit Admin Wallet via gRPC (giữ luôn, không review)
            await this.userClientService.creditAdminWallet({
                admin_id: adminUserId,
                campaign_id: null, // UNKNOWN - cannot determine from Sepay webhook
                payment_transaction_id: null, // UNKNOWN - no payment_transaction created
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: this.buildDescription(payload),
                // Store full Sepay metadata for audit/debugging
                sepay_metadata: {
                    sepay_id: payload.id,
                    reference_code: payload.referenceCode,
                    content: payload.content,
                    bank_name: payload.gateway,
                    transaction_date: payload.transactionDate,
                    accumulated: payload.accumulated,
                    sub_account: payload.subAccount,
                    description: payload.description,
                },
            })

            this.logger.log(
                `[Sepay] ✅ Admin Wallet credited (kept) - ID: ${payload.id}, Amount: ${payload.transferAmount}`,
            )
        } catch (error) {
            this.logger.error(
                `[Sepay] ❌ Failed to route to Admin Wallet - ID: ${payload.id}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * Build description from Sepay payload
     */
    private buildDescription(payload: SepayWebhookPayload): string {
        return `Sepay incoming transfer - Ref: ${payload.referenceCode} | Content: ${payload.content} | Bank: ${payload.gateway}`
    }

    /**
     * Check if webhook already processed (idempotency)
     * Uses Redis cache with 7-day TTL
     */
    private async checkIdempotency(
        sepayId: number,
        referenceCode: string,
    ): Promise<boolean> {
        try {
            // Create unique cache key combining Sepay ID and reference code
            const cacheKey = `sepay:webhook:${sepayId}:${referenceCode}`

            // Check if key exists in Redis
            const exists = await this.redisService.exists(cacheKey)

            if (exists) {
                return true // Duplicate - already processed
            }

            // Mark as processed with 7-day TTL (longer than PayOS for review time)
            const ttl = 7 * 24 * 60 * 60 // 7 days in seconds
            await this.redisService.set(cacheKey, "processed", { ex: ttl })

            return false // Not a duplicate
        } catch (error) {
            this.logger.error(
                `[Sepay] Failed to check idempotency for ${sepayId}:`,
                error,
            )
            // On Redis error, allow processing (fail open)
            // Better to process twice than miss a transaction
            return false
        }
    }

    /**
     * Get system admin user ID from environment
     */
    private getSystemAdminId(): string {
        const adminId = process.env.SYSTEM_ADMIN_ID || "admin-system-001"
        return adminId
    }
}
