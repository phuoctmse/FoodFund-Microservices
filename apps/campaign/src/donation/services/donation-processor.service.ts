import { Injectable, Logger } from "@nestjs/common"
import { DonorRepository } from "../repositories/donor.repository"
import { SqsService } from "@libs/aws-sqs"
import { PaymentStatus } from "../../shared/enum/campaign.enum"
import { PrismaClient } from "../../generated/campaign-client"

/**
 * DEPRECATED: This interface is for old PayOS flow
 * New Sepay flow uses webhook to auto-create donations
 */
export interface DonationCreateRequestMessage {
    eventType: "DONATION_CREATE_REQUEST"
    donationId: string
    donorId: string
    campaignId: string
    amount: string
    message?: string
    isAnonymous: boolean
    orderCode: number
    paymentLinkId: string
    checkoutUrl: string
    qrCode: string
    requestedAt: string
}

@Injectable()
export class DonationProcessorService {
    private readonly logger = new Logger(DonationProcessorService.name)

    constructor(
        private readonly DonorRepository: DonorRepository,
        private readonly sqsService: SqsService,
        private readonly prisma: PrismaClient,
    ) {}

    /**
     * DEPRECATED: This method is for old PayOS flow
     * New Sepay flow uses webhook to auto-create donations
     * Keeping this for backward compatibility with existing queue messages
     */
    async processDonationCreateRequest(
        message: DonationCreateRequestMessage,
    ): Promise<void> {
        this.logger.warn(
            `[QUEUE] DEPRECATED: Received old PayOS donation message: ${message.donationId}`,
            {
                donorId: message.donorId,
                campaignId: message.campaignId,
                amount: message.amount,
            },
        )

        this.logger.log(
            "[QUEUE] Skipping old PayOS message - donations are now created via Sepay webhook",
        )

        // Don't process - just log and skip
        // Donations are now created automatically by Sepay webhook
        return
    }

    private parseMessageBody(message: any): {
        body: any
        shouldDelete: boolean
    } {
        if (!message.Body) {
            this.logger.warn("Received message with empty body", {
                messageId: message.MessageId,
            })
            return { body: null, shouldDelete: true }
        }

        try {
            const body = JSON.parse(message.Body)
            return { body, shouldDelete: false }
        } catch (jsonError) {
            this.logger.error("Invalid JSON in SQS message", {
                messageId: message.MessageId,
                error: jsonError.message,
            })
            return { body: null, shouldDelete: true }
        }
    }

    private validateMessageStructure(
        messageBody: any,
        messageId: string,
    ): boolean {
        if (!messageBody.eventType) {
            this.logger.warn("Message missing eventType", { messageId })
            return false
        }
        return true
    }

    /**
     * DEPRECATED: Validation for old PayOS flow
     */
    private validateDonationCreateRequest(
        messageBody: any,
        messageId: string,
    ): boolean {
        // Skip validation for deprecated messages
        this.logger.debug("Skipping validation for deprecated PayOS message", {
            messageId,
        })
        return true
    }

    private async processMessage(message: any): Promise<boolean> {
        const { body: messageBody, shouldDelete: shouldDeleteForParsing } =
            this.parseMessageBody(message)

        if (shouldDeleteForParsing) {
            return true
        }

        if (!this.validateMessageStructure(messageBody, message.MessageId)) {
            return true
        }

        if (messageBody.eventType === "DONATION_CREATE_REQUEST") {
            if (
                !this.validateDonationCreateRequest(
                    messageBody,
                    message.MessageId,
                )
            ) {
                return true
            }
            await this.processDonationCreateRequest(
                messageBody as DonationCreateRequestMessage,
            )
            return true
        }

        this.logger.debug("Ignoring message with unknown eventType", {
            eventType: messageBody.eventType,
            messageId: message.MessageId,
        })
        return false
    }

    private async deleteMessageIfNeeded(
        shouldDelete: boolean,
        receiptHandle: string | undefined,
        messageId: string | undefined,
    ): Promise<void> {
        if (shouldDelete && receiptHandle) {
            try {
                await this.sqsService.deleteMessage(receiptHandle)
                this.logger.debug("Deleted message from queue", { messageId })
            } catch (deleteError) {
                this.logger.error("Failed to delete message from queue", {
                    messageId,
                    error: deleteError.message,
                })
            }
        }
    }

    async startQueueConsumer(): Promise<void> {
        this.logger.log("Starting donation queue consumer...")

        while (true) {
            try {
                const messages = await this.sqsService.receiveMessages({
                    maxNumberOfMessages: 10,
                    waitTimeSeconds: 20,
                    visibilityTimeout: 300,
                })

                for (const message of messages) {
                    let shouldDeleteMessage = false

                    try {
                        shouldDeleteMessage = await this.processMessage(message)
                    } catch (processingError) {
                        this.logger.error(
                            "Error processing individual message",
                            {
                                messageId: message.MessageId,
                                error: processingError.message,
                                stack: processingError.stack,
                            },
                        )
                    } finally {
                        await this.deleteMessageIfNeeded(
                            shouldDeleteMessage,
                            message.ReceiptHandle,
                            message.MessageId,
                        )
                    }
                }
            } catch (error) {
                this.logger.error("Error in queue consumer loop", error)
                await new Promise((resolve) => setTimeout(resolve, 5000))
            }
        }
    }
}
