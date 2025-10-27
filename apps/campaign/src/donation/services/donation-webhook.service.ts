import { Injectable, Logger, BadRequestException } from "@nestjs/common"
import { SepayService, SepayWebhookPayload } from "@libs/sepay"
import { DonorRepository } from "../repositories/donor.repository"
import { PaymentStatus } from "../../shared/enum/campaign.enum"
import { decodeDonationDescription } from "@libs/common"

@Injectable()
export class DonationWebhookService {
    private readonly logger = new Logger(DonationWebhookService.name)

    constructor(
        private readonly sepayService: SepayService,
        private readonly DonorRepository: DonorRepository,
    ) {}

    async handlePaymentWebhook(payload: SepayWebhookPayload): Promise<void> {
        // Validate webhook payload structure
        if (!this.sepayService.validateWebhook(payload)) {
            this.logger.warn("Invalid Sepay webhook payload", { payload })
            throw new BadRequestException("Invalid webhook payload")
        }

        const {
            id,
            gateway,
            transactionDate,
            accountNumber,
            subAccount,
            transferAmount,
            transferType,
            accumulated,
            code,
            content,
            description,
            referenceCode,
        } = payload

        // Only process incoming payments (transferType = "in")
        if (transferType !== "in" || transferAmount <= 0) {
            this.logger.log("Ignoring outgoing transaction", { id })
            return
        }

        // Decode donation data from content
        // Expected format: "DN{campaignId}" or "DN{campaignId}U{userId}"
        // Note: Sepay may truncate the suffix based on dashboard config
        // If UUID is truncated, you need to update Sepay config to allow longer suffix (32+ chars)
        const donationData = decodeDonationDescription(content)

        if (!donationData) {
            this.logger.warn(
                `Cannot decode donation data from content: ${content}`,
                { id },
            )
            return // Ignore - not a donation
        }

        const { campaignId, userId } = donationData

        this.logger.debug("[SEPAY] Decoded donation data from webhook", {
            transactionId: id,
            campaignId,
            campaignIdLength: campaignId.length,
            userId: userId || "anonymous",
            rawContent: content,
        })

        // Check for duplicate by reference (prevent double processing)
        if (referenceCode) {
            const existing =
                await this.DonorRepository.findPaymentTransactionByReference(
                    referenceCode,
                )
            if (existing) {
                this.logger.log(
                    `Duplicate webhook ignored - reference already processed: ${referenceCode}`,
                )
                return
            }
        }

        // Create donation automatically with Sepay data
        this.logger.log(
            `[SEPAY] Auto-creating donation for campaign ${campaignId}`,
            {
                transactionId: id,
                amount: transferAmount,
                content,
                reference: referenceCode,
                userId: userId || "anonymous",
            },
        )

        await this.DonorRepository.createDonationFromDynamicQR({
            campaignId,
            donorId: userId || "anonymous",
            sepayTransactionId: id,
            gateway,
            transactionDate,
            accountNumber,
            subAccount: subAccount || undefined,
            amountIn: BigInt(transferAmount), // transferAmount is always positive for "in"
            amountOut: BigInt(0), // Always 0 for incoming
            accumulated: BigInt(accumulated),
            code: code || undefined,
            transactionContent: content,
            referenceNumber: referenceCode,
            body: description, // Use full description as body
        })

        this.logger.log(
            `[SEPAY] Donation created successfully for campaign ${campaignId}`,
            {
                transactionId: id,
                amount: transferAmount,
                userId: userId || "anonymous",
            },
        )
    }
}
