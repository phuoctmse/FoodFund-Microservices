import { Injectable, Logger } from "@nestjs/common"
import { DonorRepository } from "../repositories/donor.repository"
import { SqsService } from "@libs/aws-sqs"
import { CreateDonationRepositoryInput } from "../dtos/create-donation-repository.input"

export interface DonationRequestMessage {
    eventType: "DONATION_REQUEST"
    donationId: string
    donorId: string
    campaignId: string
    amount: string
    message?: string
    isAnonymous: boolean
    requestedAt: string
    // PayOS tracking fields
    orderCode?: number
    paymentLinkId?: string
    payosTransactionData?: {
        bin: string
        accountNumber: string
        accountName: string
        checkoutUrl: string
        status: string
    }
}

@Injectable()
export class DonationProcessorService {
    private readonly logger = new Logger(DonationProcessorService.name)

    constructor(
        private readonly DonorRepository: DonorRepository,
        private readonly sqsService: SqsService,
    ) {}

    async processDonationRequest(
        message: DonationRequestMessage,
    ): Promise<void> {
        try {
            this.logger.log(
                `Processing donation request: ${message.donationId}`,
                {
                    donorId: message.donorId,
                    campaignId: message.campaignId,
                    amount: message.amount,
                    isAnonymous: message.isAnonymous,
                    orderCode: message.orderCode,
                    paymentLinkId: message.paymentLinkId,
                },
            )

            // Create donation in database with predefined ID
            const donationData: CreateDonationRepositoryInput = {
                donor_id: message.donorId,
                campaign_id: message.campaignId,
                amount: BigInt(message.amount),
                message: message.message,
                is_anonymous: message.isAnonymous,
            }

            await this.DonorRepository.createWithId(
                message.donationId,
                donationData,
            )

            // Send success notification to SQS
            await this.sqsService.sendMessage({
                messageBody: {
                    eventType: "DONATION_COMPLETED",
                    donationId: message.donationId,
                    campaignId: message.campaignId,
                    donorId: message.donorId,
                    amount: message.amount,
                    status: "SUCCESS",
                    orderCode: message.orderCode,
                    paymentLinkId: message.paymentLinkId,
                    completedAt: new Date().toISOString(),
                },
                messageAttributes: {
                    eventType: {
                        DataType: "String",
                        StringValue: "DONATION_COMPLETED",
                    },
                    campaignId: {
                        DataType: "String",
                        StringValue: message.campaignId,
                    },
                    status: {
                        DataType: "String",
                        StringValue: "SUCCESS",
                    },
                },
            })

            this.logger.log(
                `Successfully processed donation: ${message.donationId}`,
                {
                    orderCode: message.orderCode,
                    paymentLinkId: message.paymentLinkId,
                },
            )
        } catch (error) {
            this.logger.error(
                `Failed to process donation request: ${message.donationId}`,
                {
                    donorId: message.donorId,
                    campaignId: message.campaignId,
                    orderCode: message.orderCode,
                    paymentLinkId: message.paymentLinkId,
                    error: error.message,
                    stack: error.stack,
                },
            )

            // Send failure notification to SQS
            try {
                await this.sqsService.sendMessage({
                    messageBody: {
                        eventType: "DONATION_FAILED",
                        donationId: message.donationId,
                        campaignId: message.campaignId,
                        donorId: message.donorId,
                        amount: message.amount,
                        status: "FAILED",
                        error: error.message,
                        orderCode: message.orderCode,
                        paymentLinkId: message.paymentLinkId,
                        failedAt: new Date().toISOString(),
                    },
                    messageAttributes: {
                        eventType: {
                            DataType: "String",
                            StringValue: "DONATION_FAILED",
                        },
                        campaignId: {
                            DataType: "String",
                            StringValue: message.campaignId,
                        },
                        status: {
                            DataType: "String",
                            StringValue: "FAILED",
                        },
                    },
                })
            } catch (notificationError) {
                this.logger.error(
                    "Failed to send failure notification",
                    notificationError,
                )
            }

            // Re-throw error for queue retry mechanism
            throw error
        }
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

    private validateDonationRequest(
        messageBody: any,
        messageId: string,
    ): boolean {
        const requiredFields = ["donationId", "donorId", "campaignId", "amount"]
        const missingFields = requiredFields.filter(
            (field) => !messageBody[field],
        )

        if (missingFields.length > 0) {
            this.logger.error("DONATION_REQUEST missing required fields", {
                messageId,
                missingFields,
            })
            return false
        }
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

        if (messageBody.eventType === "DONATION_REQUEST") {
            if (!this.validateDonationRequest(messageBody, message.MessageId)) {
                return true
            }
            await this.processDonationRequest(
                messageBody as DonationRequestMessage,
            )
            return true
        }

        if (
            messageBody.eventType === "DONATION_COMPLETED" ||
            messageBody.eventType === "DONATION_FAILED"
        ) {
            this.logger.debug("Deleting notification message", {
                eventType: messageBody.eventType,
                messageId: message.MessageId,
            })
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
