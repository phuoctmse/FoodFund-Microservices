import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
    SQSClient,
    SendMessageCommand,
    SendMessageBatchCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    DeleteMessageBatchCommand,
    GetQueueAttributesCommand,
    SendMessageBatchRequestEntry,
    Message,
} from "@aws-sdk/client-sqs"
import { envConfig } from "@libs/env"

export interface SendMessageOptions {
    messageBody: any
    delaySeconds?: number
    messageAttributes?: Record<string, any>
    messageGroupId?: string
    messageDeduplicationId?: string
}

export interface ReceiveMessageOptions {
    maxNumberOfMessages?: number
    waitTimeSeconds?: number
    visibilityTimeout?: number
    attributeNames?: string[]
    messageAttributeNames?: string[]
}

@Injectable()
export class SqsService implements OnModuleInit {
    private readonly logger = new Logger(SqsService.name)
    private client: SQSClient
    private queueUrl: string

    constructor() {}

    async onModuleInit() {
        const env = envConfig()
        const region = env.aws.region
        const queueUrl = env.aws.awsSqsQueueUrl

        if (!queueUrl) {
            this.logger.warn(
                "AWS_SQS_QUEUE_URL not configured. SQS will not be available.",
            )
            return
        }

        this.queueUrl = queueUrl

        const accessKeyId = env.aws.accessKeyId
        const secretAccessKey = env.aws.secretAccessKey

        this.client = new SQSClient({
            region,
            ...(accessKeyId &&
                secretAccessKey && {
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            }),
        })

        try {
            // Test connection by getting queue attributes
            const command = new GetQueueAttributesCommand({
                QueueUrl: this.queueUrl,
                AttributeNames: ["QueueArn"],
            })
            const response = await this.client.send(command)
            this.logger.log(
                `Connected to SQS queue: ${response.Attributes?.QueueArn}`,
            )
        } catch (error) {
            this.logger.error("Failed to connect to SQS", error)
            throw error
        }
    }

    getClient(): SQSClient {
        if (!this.client) {
            throw new Error("SQS client not initialized")
        }
        return this.client
    }

    async sendMessage(options: SendMessageOptions): Promise<string> {
        const {
            messageBody,
            delaySeconds,
            messageAttributes,
            messageGroupId,
            messageDeduplicationId,
        } = options

        try {
            const command = new SendMessageCommand({
                QueueUrl: this.queueUrl,
                MessageBody:
                    typeof messageBody === "string"
                        ? messageBody
                        : JSON.stringify(messageBody),
                ...(delaySeconds && { DelaySeconds: delaySeconds }),
                ...(messageAttributes && {
                    MessageAttributes:
                        this.formatMessageAttributes(messageAttributes),
                }),
                ...(messageGroupId && { MessageGroupId: messageGroupId }),
                ...(messageDeduplicationId && {
                    MessageDeduplicationId: messageDeduplicationId,
                }),
            })

            const response = await this.client.send(command)
            this.logger.debug(`Message sent to SQS: ${response.MessageId}`)
            return response.MessageId || ""
        } catch (error) {
            this.logger.error("Failed to send message to SQS", error)
            throw error
        }
    }

    async sendMessageBatch(messages: SendMessageOptions[]): Promise<any> {
        if (messages.length === 0) {
            return { successful: [], failed: [] }
        }

        const allSuccessful: any[] = []
        const allFailed: any[] = []
        const batchSize = 10

        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize)

            try {
                const entries: SendMessageBatchRequestEntry[] = batch.map(
                    (msg, index) => ({
                        Id: `msg-${i + index}`,
                        MessageBody:
                            typeof msg.messageBody === "string"
                                ? msg.messageBody
                                : JSON.stringify(msg.messageBody),
                        ...(msg.delaySeconds && {
                            DelaySeconds: msg.delaySeconds,
                        }),
                        ...(msg.messageAttributes && {
                            MessageAttributes: this.formatMessageAttributes(
                                msg.messageAttributes,
                            ),
                        }),
                        ...(msg.messageGroupId && {
                            MessageGroupId: msg.messageGroupId,
                        }),
                        ...(msg.messageDeduplicationId && {
                            MessageDeduplicationId: msg.messageDeduplicationId,
                        }),
                    }),
                )

                const command = new SendMessageBatchCommand({
                    QueueUrl: this.queueUrl,
                    Entries: entries,
                })

                const response = await this.client.send(command)
                this.logger.debug(
                    `Batch sent: ${response.Successful?.length} successful, ${response.Failed?.length} failed`,
                )

                if (response.Successful) {
                    allSuccessful.push(...response.Successful)
                }
                if (response.Failed) {
                    allFailed.push(...response.Failed)
                }
            } catch (error) {
                this.logger.error(
                    "Failed to send a batch of messages to SQS",
                    error,
                )
                // If the whole batch request fails, mark all messages in it as failed.
                const failedEntries = batch.map((msg, index) => ({
                    Id: `msg-${i + index}`,
                    SenderFault: true,
                    Code: "BatchRequestError",
                    Message: error.message,
                }))
                allFailed.push(...failedEntries)
            }
        }

        return {
            successful: allSuccessful,
            failed: allFailed,
        }
    }

    async receiveMessages(
        options: ReceiveMessageOptions = {},
    ): Promise<Message[]> {
        const {
            maxNumberOfMessages = 1,
            waitTimeSeconds = 0,
            visibilityTimeout,
            attributeNames = ["All"],
            messageAttributeNames = ["All"],
        } = options

        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: maxNumberOfMessages,
                WaitTimeSeconds: waitTimeSeconds,
                ...(visibilityTimeout && {
                    VisibilityTimeout: visibilityTimeout,
                }),
                AttributeNames: attributeNames as any,
                MessageAttributeNames: messageAttributeNames as any,
            })

            const response = await this.client.send(command)
            return response.Messages || []
        } catch (error) {
            this.logger.error("Failed to receive messages from SQS", error)
            throw error
        }
    }

    async deleteMessage(receiptHandle: string): Promise<void> {
        try {
            const command = new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle,
            })

            await this.client.send(command)
            this.logger.debug("Message deleted from SQS")
        } catch (error) {
            this.logger.error("Failed to delete message from SQS", error)
            throw error
        }
    }

    async deleteMessageBatch(receiptHandles: string[]): Promise<any> {
        if (receiptHandles.length === 0) {
            return { successful: [], failed: [] }
        }

        if (receiptHandles.length > 10) {
            throw new Error("Cannot delete more than 10 messages in a batch")
        }

        try {
            const entries = receiptHandles.map((handle, index) => ({
                Id: `msg-${index}`,
                ReceiptHandle: handle,
            }))

            const command = new DeleteMessageBatchCommand({
                QueueUrl: this.queueUrl,
                Entries: entries,
            })

            const response = await this.client.send(command)
            this.logger.debug(
                `Batch deleted: ${response.Successful?.length} successful, ${response.Failed?.length} failed`,
            )

            return {
                successful: response.Successful || [],
                failed: response.Failed || [],
            }
        } catch (error) {
            this.logger.error("Failed to delete batch messages from SQS", error)
            throw error
        }
    }

    async getQueueAttributes(
        attributeNames: string[] = ["All"],
    ): Promise<Record<string, string>> {
        try {
            const command = new GetQueueAttributesCommand({
                QueueUrl: this.queueUrl,
                AttributeNames: attributeNames as any,
            })

            const response = await this.client.send(command)
            return response.Attributes || {}
        } catch (error) {
            this.logger.error("Failed to get queue attributes", error)
            throw error
        }
    }

    private formatMessageAttributes(
        attributes: Record<string, any>,
    ): Record<string, any> {
        const formatted: Record<string, any> = {}

        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === "string") {
                formatted[key] = { DataType: "String", StringValue: value }
            } else if (typeof value === "number") {
                formatted[key] = {
                    DataType: "Number",
                    StringValue: value.toString(),
                }
            } else {
                formatted[key] = {
                    DataType: "String",
                    StringValue: JSON.stringify(value),
                }
            }
        }

        return formatted
    }

    parseMessageBody<T = any>(message: Message): T {
        try {
            return JSON.parse(message.Body || "{}")
        } catch {
            return message.Body as any
        }
    }
}
