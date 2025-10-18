import { Injectable, Logger } from "@nestjs/common"
import { DonationRepository } from "../repositories/donation.repository"
import { CreateDonationRepositoryInput } from "../dtos/create-donation-repository.input"
import { SqsService } from "@libs/aws-sqs"

export interface DonationRequestMessage {
    eventType: "DONATION_REQUEST"
    donationId: string
    donorId: string
    campaignId: string
    amount: string
    message?: string
    isAnonymous: boolean
    requestedAt: string
}

@Injectable()
export class DonationProcessorService {
    private readonly logger = new Logger(DonationProcessorService.name)

    constructor(
        private readonly donationRepository: DonationRepository,
        private readonly sqsService: SqsService,
    ) {}

    async processDonationRequest(message: DonationRequestMessage): Promise<void> {
        try {
            this.logger.log(`Processing donation request: ${message.donationId}`)

            // Create donation in database with predefined ID
            const donationData: CreateDonationRepositoryInput = {
                donor_id: message.donorId,
                campaign_id: message.campaignId,
                amount: BigInt(message.amount),
                message: message.message,
                is_anonymous: message.isAnonymous,
            }

            const createdDonation = await this.donationRepository.createWithId(message.donationId, donationData)

            // Send success notification to SQS
            await this.sqsService.sendMessage({
                messageBody: {
                    eventType: "DONATION_COMPLETED",
                    donationId: message.donationId,
                    campaignId: message.campaignId,
                    donorId: message.donorId,
                    amount: message.amount,
                    status: "SUCCESS",
                    completedAt: new Date().toISOString(),
                },
                messageAttributes: {
                    eventType: {
                        DataType: "String",
                        StringValue: "DONATION_COMPLETED"
                    },
                    campaignId: {
                        DataType: "String",
                        StringValue: message.campaignId
                    },
                    status: {
                        DataType: "String",
                        StringValue: "SUCCESS"
                    }
                }
            })

            this.logger.log(`Successfully processed donation: ${message.donationId}`)
        } catch (error) {
            this.logger.error(`Failed to process donation request: ${message.donationId}`, error)

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
                        failedAt: new Date().toISOString(),
                    },
                    messageAttributes: {
                        eventType: {
                            DataType: "String",
                            StringValue: "DONATION_FAILED"
                        },
                        campaignId: {
                            DataType: "String",
                            StringValue: message.campaignId
                        },
                        status: {
                            DataType: "String",
                            StringValue: "FAILED"
                        }
                    }
                })
            } catch (notificationError) {
                this.logger.error("Failed to send failure notification", notificationError)
            }

            // Re-throw error for queue retry mechanism
            throw error
        }
    }

    async startQueueConsumer(): Promise<void> {
        this.logger.log("Starting donation queue consumer...")
        
        while (true) {
            try {
                const messages = await this.sqsService.receiveMessages({
                    maxNumberOfMessages: 10,
                    waitTimeSeconds: 20,
                    visibilityTimeout: 300, // 5 minutes
                })

                for (const message of messages) {
                    try {
                        const messageBody = JSON.parse(message.Body || "{}")
                        
                        if (messageBody.eventType === "DONATION_REQUEST") {
                            await this.processDonationRequest(messageBody as DonationRequestMessage)
                            
                            // Delete message from queue after successful processing
                            await this.sqsService.deleteMessage(message.ReceiptHandle!)
                        }
                    } catch (processingError) {
                        this.logger.error("Error processing individual message", processingError)
                        // Message will be retried based on SQS visibility timeout
                    }
                }
            } catch (error) {
                this.logger.error("Error in queue consumer loop", error)
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 5000))
            }
        }
    }
}