import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { RedisService } from "@libs/redis"
import { envConfig } from "@libs/env"
import { UserClientService } from "@app/campaign/src/shared"
import { DonorRepository } from "../../repositories/donor.repository"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"

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
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /**
     * Handle Sepay webhook - Route ALL transfers to Admin Wallet
     * NEW LOGIC: All Sepay transfers now go to Admin Wallet
     * 
     * DUPLICATE PREVENTION:
     * - If orderCode exists AND amount >= original: Skip (PayOS will handle)
     * - If orderCode exists AND amount < original: Process PARTIAL payment
     * - If no orderCode: Process as regular transfer
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

        // Extract orderCode to check for PayOS payment
        const orderCode = this.extractOrderCodeFromContent(payload.content)

        if (orderCode) {
            // OrderCode found - check if PayOS will handle this
            await this.handlePayOSRelatedTransfer(payload, orderCode)
        } else {
            // No orderCode - regular Sepay transfer
            this.logger.log(
                "[Sepay] No orderCode detected - routing to Admin Wallet",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    /**
     * Handle Sepay transfer that has orderCode (PayOS-related)
     * LOGIC:
     * 1. Check if this sepayId already processed → skip (idempotency)
     * 2. Find original payment by orderCode
     * 3. If payment NOT processed yet (PENDING) → process as initial payment
     * 4. If payment already SUCCESS → create supplementary payment (new Payment_Transaction)
     * 5. If amount >= original → skip (PayOS will handle to avoid duplicate)
     */
    private async handlePayOSRelatedTransfer(
        payload: SepayWebhookPayload,
        orderCode: string,
    ): Promise<void> {
        try {
            this.logger.log(
                `[Sepay] Detected orderCode=${orderCode}, checking payment status`,
            )

            // IDEMPOTENCY: Check if this sepayId already processed
            const existingPayment = await this.donorRepository.findPaymentBySepayId(payload.id)
            if (existingPayment) {
                this.logger.log(
                    `[Sepay] ⚠️ Skipping - sepayId ${payload.id} already processed (Payment: ${existingPayment.id})`,
                )
                return
            }

            // Find ORIGINAL payment by orderCode
            const paymentTransaction =
                await this.donorRepository.findPaymentTransactionByOrderCode(
                    BigInt(orderCode),
                )

            if (!paymentTransaction) {
                this.logger.warn(
                    `[Sepay] Payment transaction not found for orderCode=${orderCode} - routing to Admin as regular transfer`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const sepayAmount = BigInt(payload.transferAmount)
            const originalAmount = paymentTransaction.amount

            // Case 1: Sepay amount >= original amount
            // → Skip, let PayOS handle (to avoid duplicate between PayOS + Sepay)
            if (sepayAmount >= originalAmount) {
                this.logger.log(
                    `[Sepay] ⚠️ Skipping - Sepay amount (${sepayAmount}) >= original (${originalAmount}). PayOS webhook will handle this to avoid duplicate.`,
                )
                return
            }

            // Case 2: Original payment NOT processed yet (PENDING)
            // → Process as initial PARTIAL payment (update original Payment_Transaction)
            if (!paymentTransaction.processed_by_webhook) {
                this.logger.log(
                    `[Sepay] 💰 Processing initial PARTIAL payment - ${sepayAmount}/${originalAmount}`,
                )
                await this.processPartialPaymentToAdmin(payload, paymentTransaction, orderCode)
                return
            }

            // Case 3: Original payment already processed (SUCCESS)
            // → This is a SUPPLEMENTARY payment (create NEW Payment_Transaction)
            this.logger.log(
                `[Sepay] 💰 Processing SUPPLEMENTARY payment - amount=${sepayAmount} (original already processed)`,
            )
            await this.processSupplementaryPayment(payload, paymentTransaction)

        } catch (error) {
            this.logger.error(
                `[Sepay] ❌ Failed to handle PayOS-related transfer - orderCode=${orderCode}`,
                error.stack,
            )
            // Fallback to Admin Wallet on error
            this.logger.log(
                "[Sepay] Fallback: Routing to Admin Wallet instead",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    /**
     * Process PARTIAL payment to Admin Wallet
     * Update payment_transaction and credit Admin Wallet
     */
    private async processPartialPaymentToAdmin(
        payload: SepayWebhookPayload,
        paymentTransaction: any,
        orderCode: string,
    ): Promise<void> {
        try {
            const donation = paymentTransaction.donation
            if (!donation || !donation.campaign) {
                this.logger.error(
                    `[Sepay→Admin] Donation or campaign not found for payment ${paymentTransaction.id}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const campaignId = donation.campaign_id

            // Step 1: Update payment_transaction to SUCCESS with PARTIAL status
            const result = await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                amount_paid: BigInt(payload.transferAmount), // Actual amount (< original)
                gateway: "SEPAY",
                processed_by_webhook: true,
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
                `[Sepay→Admin] ✅ Payment updated to SUCCESS with PARTIAL status - orderCode=${orderCode}, amount=${payload.transferAmount}/${paymentTransaction.amount}`,
            )

            // 🆕 Check for campaign surplus and emit event
            this.checkAndEmitSurplusEvent(result.campaign)

            // Step 2: Get system admin ID
            const adminUserId = this.getSystemAdminId()

            // Step 3: Credit Admin Wallet with actual amount
            // NOTE: gateway and sepay_metadata are stored in Payment_Transaction, NOT Wallet_Transaction
            // Wallet_Transaction links to Payment_Transaction via payment_transaction_id
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: campaignId,
                paymentTransactionId: paymentTransaction.id,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY", // For logging/description only, NOT stored in Wallet_Transaction
                description: `Partial payment via Sepay - Order ${orderCode} | Ref: ${payload.referenceCode}`,
            })

            this.logger.log(
                `[Sepay→Admin] ✅ Admin wallet credited - orderCode=${orderCode}, amount=${payload.transferAmount}`,
            )
        } catch (error) {
            this.logger.error(
                `[Sepay→Admin] ❌ Failed to process partial payment - orderCode=${orderCode}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * Process SUPPLEMENTARY payment (additional transfer for same donation)
     * Creates NEW Payment_Transaction record (without order_code)
     */
    private async processSupplementaryPayment(
        payload: SepayWebhookPayload,
        originalPayment: any,
    ): Promise<void> {
        try {
            const donation = originalPayment.donation
            if (!donation || !donation.campaign) {
                this.logger.error(
                    `[Sepay→Admin] Donation or campaign not found for original payment ${originalPayment.id}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const campaignId = donation.campaign_id
            const donationId = donation.id

            // Step 1: Create NEW Payment_Transaction (supplementary payment)
            const result = await this.donorRepository.createSupplementaryPayment({
                donation_id: donationId,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: `Supplementary payment via Sepay | Ref: ${payload.referenceCode}`,
                sepay_metadata: {
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
                `[Sepay→Admin] ✅ Supplementary payment created - Payment ID: ${result.payment.id}, amount=${payload.transferAmount}`,
            )

            // 🆕 Check for campaign surplus and emit event
            this.checkAndEmitSurplusEvent(result.campaign)

            // Step 2: Get system admin ID
            const adminUserId = this.getSystemAdminId()

            // Step 3: Credit Admin Wallet
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: campaignId,
                paymentTransactionId: result.payment.id,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY", // For logging only
                description: `Supplementary payment via Sepay | Ref: ${payload.referenceCode}`,
            })

            this.logger.log(
                `[Sepay→Admin] ✅ Admin wallet credited for supplementary payment - amount=${payload.transferAmount}`,
            )
        } catch (error) {
            this.logger.error(
                "[Sepay→Admin] ❌ Failed to process supplementary payment",
                error.stack,
            )
            throw error
        }
    }

    private checkAndEmitSurplusEvent(campaign: any): void {
        if (campaign.received_amount > campaign.target_amount && campaign.status === CampaignStatus.ACTIVE) {
            const surplus = campaign.received_amount - campaign.target_amount
            this.logger.log(
                `[Sepay→Admin] 🎯 Surplus detected for campaign ${campaign.id} - Surplus: ${surplus.toString()} VND`,
            )
            this.eventEmitter.emit("campaign.surplus.detected", {
                campaignId: campaign.id,
                surplus: surplus.toString(),
            })
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
                `[Sepay→Admin] Routing non-donation transfer to Admin Wallet - Admin ID: ${adminUserId}`,
            )

            // Credit Admin Wallet via gRPC
            // NOTE: This is a NON-DONATION transfer (no payment_transaction_id)
            // Gateway and sepay_metadata WILL BE stored in Wallet_Transaction
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: null, // No campaign (non-donation transfer)
                paymentTransactionId: null, // No payment_transaction (non-donation transfer)
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY", // Will be stored in Wallet_Transaction
                description: this.buildDescription(payload),
                // Store full Sepay metadata in Wallet_Transaction (for audit/debugging)
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
                `[Sepay→Admin] ✅ Admin Wallet credited (non-donation) - Sepay ID: ${payload.id}, Amount: ${payload.transferAmount}`,
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
