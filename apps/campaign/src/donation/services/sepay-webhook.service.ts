import { Injectable, Logger } from "@nestjs/common"
import { UserClientService } from "../../shared/services/user-client.service"
import { RedisService } from "@libs/redis"
import { DonorRepository } from "../repositories/donor.repository"
import { envConfig } from "@libs/env"
import { TransactionStatus } from "../../shared/enum/campaign.enum"

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
        private readonly donorRepository: DonorRepository,
    ) {}

    /**
     * Handle Sepay webhook - Route transfers based on content
     * NEW LOGIC: Check for orderCode in content to route correctly
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
            this.logger.log(
                `[Sepay] Ignoring outgoing transfer: ${payload.id}`,
            )
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

        // CRITICAL: Extract orderCode from content to determine routing
        const orderCode = this.extractOrderCodeFromContent(payload.content)

        if (orderCode) {
            // PayOS payment detected → Route to Fundraiser Wallet (supports supplements)
            this.logger.log(
                `[Sepay] Detected PayOS payment - orderCode=${orderCode}`,
            )
            await this.routeToFundraiserWallet(payload, orderCode)
        } else {
            // No orderCode → Route to Admin Wallet (catch-all)
            this.logger.log(
                "[Sepay] No orderCode detected - routing to Admin Wallet",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    /**
     * Route incoming transfer to Admin Wallet (catch-all for non-PayOS transfers)
     * NOTE: Admin wallet must be created first in User service
     */
    private async routeToAdminWallet(
        payload: SepayWebhookPayload,
    ): Promise<void> {
        try {
            // Get system admin ID from environment
            const adminUserId = this.getSystemAdminId()

            this.logger.log(
                `[Sepay→Admin] Routing to Admin Wallet - Admin ID: ${adminUserId}`,
            )

            // Credit Admin Wallet via gRPC
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: null, // UNKNOWN - cannot determine from Sepay webhook
                paymentTransactionId: null, // UNKNOWN - no payment_transaction created
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: this.buildDescription(payload),
                // Store full Sepay metadata for audit/debugging
                sepayMetadata: {
                    sepayId: payload.id,
                    referenceCode: payload.referenceCode,
                    content: payload.content,
                    bankName: payload.gateway,
                    transactionDate: payload.transactionDate,
                    accumulated: payload.accumulated,
                    subAccount: payload.subAccount,
                    description: payload.description,
                },
            })

            this.logger.log(
                `[Sepay→Admin] ✅ Admin Wallet credited - ID: ${payload.id}, Amount: ${payload.transferAmount}`,
            )
        } catch (error) {
            // If admin wallet doesn't exist, log warning but don't crash
            if (error.message?.includes("ADMIN wallet not found")) {
                this.logger.warn(
                    `[Sepay→Admin] ⚠️ Admin wallet not found - skipping transfer routing. Please create admin wallet first. Transfer ID: ${payload.id}, Amount: ${payload.transferAmount}`,
                )
                this.logger.warn(
                    `[Sepay→Admin] Transfer details: Ref=${payload.referenceCode}, Bank=${payload.gateway}, Content="${payload.content}"`,
                )
                // Don't throw - just log for manual review
                return
            }

            // Other errors - log and throw
            this.logger.error(
                `[Sepay→Admin] ❌ Failed to route to Admin Wallet - ID: ${payload.id}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * SCENARIO 2: Route Sepay transfer to Fundraiser Wallet (ONLY for PARTIAL payments)
     * This handles ONLY when user transfers LESS than required amount (1 time only, no supplements)
     */
    private async routeToFundraiserWallet(
        payload: SepayWebhookPayload,
        orderCode: string,
    ): Promise<void> {
        try {
            this.logger.log(
                `[Sepay→Fundraiser] Processing orderCode=${orderCode}, amount=${payload.transferAmount}`,
            )

            // Step 1: Find payment_transaction by orderCode
            const paymentTransaction =
                await this.donorRepository.findPaymentTransactionByOrderCode(
                    BigInt(orderCode),
                )

            if (!paymentTransaction) {
                this.logger.warn(
                    `[Sepay→Fundraiser] Payment transaction not found for orderCode=${orderCode} - routing to Admin instead`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            // Step 2: CRITICAL - Sepay ONLY handles PARTIAL payments (< amount)
            // PayOS handles COMPLETED/OVERPAID (>= amount)
            
            // Check 1: If Sepay amount >= original, this belongs to PayOS
            if (BigInt(payload.transferAmount) >= paymentTransaction.amount) {
                this.logger.log(
                    `[Sepay→Fundraiser] ⚠️ Skipping - Sepay amount (${payload.transferAmount}) >= original (${paymentTransaction.amount}). PayOS will handle this (Scenario 1: Chuyển đủ/dư).`,
                )
                return
            }

            // Check 2: If payment already processed (SUCCESS), this is a DUPLICATE or SUPPLEMENT attempt
            // Route to Admin Wallet for manual review (user might have copied old orderCode)
            if (paymentTransaction.status === TransactionStatus.SUCCESS) {
                this.logger.warn(
                    `[Sepay→Fundraiser] ⚠️ Payment already processed with status SUCCESS (orderCode=${orderCode}). User may have copied old description. Routing to Admin Wallet for manual review.`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            // Step 3: This is a PARTIAL payment (< amount) - Process it (1 time only)
            this.logger.log(
                `[Sepay→Fundraiser] 💰 PARTIAL payment detected - amount=${payload.transferAmount}/${paymentTransaction.amount}`,
            )

            // Step 4: Get donation and campaign info
            const donation = paymentTransaction.donation
            if (!donation || !donation.campaign) {
                this.logger.error(
                    `[Sepay→Fundraiser] Donation or campaign not found for payment ${paymentTransaction.id}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const campaignId = donation.campaign_id
            const fundraiserCognitoId = donation.campaign.created_by

            // Step 5: Get fundraiser user_id from cognito_id
            const fundraiserUser =
                await this.userClientService.getUserByCognitoId(
                    fundraiserCognitoId,
                )

            if (!fundraiserUser || !fundraiserUser.id) {
                this.logger.error(
                    `[Sepay→Fundraiser] Fundraiser user not found for cognito_id ${fundraiserCognitoId}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const fundraiserId = fundraiserUser.id

            // Step 6: Update payment_transaction to SUCCESS with PARTIAL status
            await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                amount_paid: BigInt(payload.transferAmount), // Actual amount (< original)
                gateway: "SEPAY",
                processed_by_webhook: true,
                sepay_metadata: {
                    sepay_id: payload.id,
                    reference_code: payload.referenceCode,
                    content: payload.content,
                    bank_name: payload.gateway, // gateway field contains bank name
                    transaction_date: payload.transactionDate,
                    accumulated: payload.accumulated,
                    sub_account: payload.subAccount,
                    description: payload.description,
                },
            })

            this.logger.log(
                `[Sepay→Fundraiser] ✅ Payment updated to SUCCESS with PARTIAL status - orderCode=${orderCode}, amount=${payload.transferAmount}/${paymentTransaction.amount}`,
            )

            // Step 7: Credit Fundraiser Wallet with actual amount
            await this.userClientService.creditFundraiserWallet({
                fundraiserId: fundraiserId,
                campaignId: campaignId,
                paymentTransactionId: paymentTransaction.id,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: `Partial payment via Sepay - Order ${orderCode} | Ref: ${payload.referenceCode}`,
            })

            this.logger.log(
                `[Sepay→Fundraiser] ✅ Fundraiser wallet credited - orderCode=${orderCode}, amount=${payload.transferAmount}`,
            )
        } catch (error) {
            this.logger.error(
                `[Sepay→Fundraiser] ❌ Failed to route to Fundraiser - orderCode=${orderCode}`,
                error.stack,
            )
            // Fallback to Admin Wallet on error
            this.logger.log(
                "[Sepay→Fundraiser] Fallback: Routing to Admin Wallet instead",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    /**
     * Extract orderCode from Sepay transfer content
     * OrderCode format: {timestamp}{randomSuffix} = 13 digits + 3 digits = 16 digits total
     * Example: 1762653025868727
     * 
     * Sepay content example:
     * "ZP253130089790 251109000580175 CSF3FD8XUZ2 1762653025868727 GD 089790-110925 08:51:02"
     */
    private extractOrderCodeFromContent(content: string): string | null {
        try {
            // PayOS orderCode is exactly 16 digits (timestamp + 3 random digits)
            // Match all 16-digit numbers in the content
            const sixteenDigitPattern = /\b(\d{16})\b/g
            const matches = content.match(sixteenDigitPattern)
            
            if (matches && matches.length > 0) {
                // If multiple 16-digit numbers, take the first one
                // (orderCode typically appears in the middle of Sepay content)
                const orderCode = matches[0]
                
                this.logger.debug(
                    `[Sepay] Extracted orderCode: ${orderCode} from content: "${content}"`,
                )
                return orderCode
            }
            
            this.logger.debug(
                `[Sepay] No 16-digit orderCode found in content: "${content}"`,
            )
            return null
        } catch (error) {
            this.logger.error(
                `[Sepay] Failed to extract orderCode from content: "${content}"`,
                error,
            )
            return null
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
        const adminId = envConfig().systemAdminId || "admin-system-001"
        return adminId
    }
}
