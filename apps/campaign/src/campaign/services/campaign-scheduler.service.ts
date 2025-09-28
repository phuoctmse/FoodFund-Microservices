import { Injectable, Logger } from "@nestjs/common"
import { CampaignRepository } from "../campaign.repository"
import { SentryService } from "@libs/observability/sentry.service"
import { CampaignStatus } from "@libs/databases/prisma/schemas/enums/campaign.enum"
import { Campaign } from "@libs/databases/prisma/schemas/models/campaign.model"

interface StatusTransitionResult {
    campaignId: string
    oldStatus: CampaignStatus
    newStatus: CampaignStatus
    reason: string
    success: boolean
    error?: string
}

interface JobExecutionResult {
    jobName: string
    totalProcessed: number
    successCount: number
    failureCount: number
    results: StatusTransitionResult[]
    executionTime: number
    timestamp: Date
}

@Injectable()
export class CampaignSchedulerService {
    private readonly logger = new Logger(CampaignSchedulerService.name)

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Activate approved campaigns that have reached their start date
     */
    async activateApprovedCampaigns(): Promise<JobExecutionResult> {
        const startTime = Date.now()
        const results: StatusTransitionResult[] = []
        let successCount = 0
        let failureCount = 0

        try {
            const campaigns = await this.findApprovedCampaignsToActivate()
            this.logger.log(`Found ${campaigns.length} campaigns to activate`)

            const batchSize = 10
            for (let i = 0; i < campaigns.length; i += batchSize) {
                const batch = campaigns.slice(i, i + batchSize)
                const batchResults = await this.processCampaignBatch(
                    batch,
                    this.activateCampaign.bind(this),
                    "ACTIVATION",
                )

                results.push(...batchResults)
                successCount += batchResults.filter((r) => r.success).length
                failureCount += batchResults.filter((r) => !r.success).length

                if (i + batchSize < campaigns.length) {
                    await this.delay(100)
                }
            }

            const executionTime = Date.now() - startTime
            this.logger.log(
                `Activation job completed: ${successCount} success, ${failureCount} failed in ${executionTime}ms`,
            )

            return {
                jobName: "ACTIVATE_APPROVED_CAMPAIGNS",
                totalProcessed: campaigns.length,
                successCount,
                failureCount,
                results,
                executionTime,
                timestamp: new Date(),
            }
        } catch (error) {
            this.logger.error("Failed to execute activation job:", error)
            this.sentryService.captureError(error as Error, {
                operation: "activateApprovedCampaigns",
                context: "cron-job",
            })
            throw error
        }
    }

    /**
     * Complete active campaigns that have reached their end date or target amount
     */
    async completeActiveCampaigns(): Promise<JobExecutionResult> {
        const startTime = Date.now()
        const results: StatusTransitionResult[] = []
        let successCount = 0
        let failureCount = 0

        try {
            const campaignsToComplete =
                await this.findActiveCampaignsToComplete()
            this.logger.log(
                `Found ${campaignsToComplete.length} campaigns to complete`,
            )

            const batchSize = 10
            for (let i = 0; i < campaignsToComplete.length; i += batchSize) {
                const batch = campaignsToComplete.slice(i, i + batchSize)
                const batchResults = await this.processCampaignBatch(
                    batch,
                    this.completeCampaign.bind(this),
                    "COMPLETION",
                )

                results.push(...batchResults)
                successCount += batchResults.filter((r) => r.success).length
                failureCount += batchResults.filter((r) => !r.success).length

                if (i + batchSize < campaignsToComplete.length) {
                    await this.delay(100)
                }
            }

            const executionTime = Date.now() - startTime
            this.logger.log(
                `Completion job completed: ${successCount} success, ${failureCount} failed in ${executionTime}ms`,
            )

            return {
                jobName: "COMPLETE_ACTIVE_CAMPAIGNS",
                totalProcessed: campaignsToComplete.length,
                successCount,
                failureCount,
                results,
                executionTime,
                timestamp: new Date(),
            }
        } catch (error) {
            this.logger.error("Failed to execute completion job:", error)
            this.sentryService.captureError(error as Error, {
                operation: "completeActiveCampaigns",
                context: "cron-job",
            })
            throw error
        }
    }

    /**
     * Handle expired campaigns (PENDING -> REJECTED, APPROVED -> CANCELLED)
     */
    async handleExpiredCampaigns(): Promise<JobExecutionResult> {
        const startTime = Date.now()
        const results: StatusTransitionResult[] = []
        let successCount = 0
        let failureCount = 0

        try {
            const expiredCampaigns = await this.findExpiredCampaigns()
            this.logger.log(
                `Found ${expiredCampaigns.length} expired campaigns to handle`,
            )

            const batchSize = 10
            for (let i = 0; i < expiredCampaigns.length; i += batchSize) {
                const batch = expiredCampaigns.slice(i, i + batchSize)
                const batchResults = await this.processCampaignBatch(
                    batch,
                    this.handleExpiredCampaign.bind(this),
                    "EXPIRATION",
                )

                results.push(...batchResults)
                successCount += batchResults.filter((r) => r.success).length
                failureCount += batchResults.filter((r) => !r.success).length

                if (i + batchSize < expiredCampaigns.length) {
                    await this.delay(100)
                }
            }

            const executionTime = Date.now() - startTime
            this.logger.log(
                `Expiration job completed: ${successCount} success, ${failureCount} failed in ${executionTime}ms`,
            )

            return {
                jobName: "HANDLE_EXPIRED_CAMPAIGNS",
                totalProcessed: expiredCampaigns.length,
                successCount,
                failureCount,
                results,
                executionTime,
                timestamp: new Date(),
            }
        } catch (error) {
            this.logger.error("Failed to execute expiration job:", error)
            this.sentryService.captureError(error as Error, {
                operation: "handleExpiredCampaigns",
                context: "cron-job",
            })
            throw error
        }
    }

    private async findApprovedCampaignsToActivate(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        return await this.campaignRepository
            .findMany({
                filter: {
                    status: [CampaignStatus.APPROVED],
                },
                limit: 1000,
            })
            .then((campaigns) =>
                campaigns.filter((campaign) => {
                    const startDate = new Date(campaign.startDate)
                    startDate.setHours(0, 0, 0, 0)
                    return startDate <= today
                }),
            )
    }

    private async findActiveCampaignsToComplete(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        return await this.campaignRepository
            .findMany({
                filter: {
                    status: [CampaignStatus.ACTIVE],
                },
                limit: 1000,
            })
            .then((campaigns) =>
                campaigns.filter((campaign) => {
                    const endDate = new Date(campaign.endDate)
                    endDate.setHours(23, 59, 59, 999)

                    const targetReached =
                        BigInt(campaign.receivedAmount) >=
                        BigInt(campaign.targetAmount)
                    const dateExpired = endDate <= today

                    return targetReached || dateExpired
                }),
            )
    }

    private async findExpiredCampaigns(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        return await this.campaignRepository
            .findMany({
                filter: {
                    status: [CampaignStatus.PENDING, CampaignStatus.APPROVED],
                },
                limit: 1000,
            })
            .then((campaigns) =>
                campaigns.filter((campaign) => {
                    const endDate = new Date(campaign.endDate)
                    endDate.setHours(23, 59, 59, 999)
                    return endDate <= today
                }),
            )
    }

    private async processCampaignBatch(
        campaigns: Campaign[],
        processor: (campaign: Campaign) => Promise<StatusTransitionResult>,
        operation: string,
    ): Promise<StatusTransitionResult[]> {
        const results: StatusTransitionResult[] = []

        const promises = campaigns.map(async (campaign) => {
            try {
                const result = await processor(campaign)
                return result
            } catch (error) {
                this.logger.error(
                    `${operation} - Campaign ${campaign.id} failed:`,
                    error,
                )
                return {
                    campaignId: campaign.id,
                    oldStatus: campaign.status,
                    newStatus: campaign.status,
                    reason: `${operation}_ERROR`,
                    success: false,
                    error: error.message,
                }
            }
        })

        const batchResults = await Promise.allSettled(promises)

        batchResults.forEach((result, index) => {
            if (result.status === "fulfilled") {
                results.push(result.value)
            } else {
                const campaign = campaigns[index]
                results.push({
                    campaignId: campaign.id,
                    oldStatus: campaign.status,
                    newStatus: campaign.status,
                    reason: `${operation}_PROMISE_REJECTED`,
                    success: false,
                    error: result.reason?.message || "Unknown error",
                })
            }
        })

        return results
    }

    private async activateCampaign(
        campaign: Campaign,
    ): Promise<StatusTransitionResult> {
        try {
            const updatedCampaign = await this.campaignRepository.update(
                campaign.id,
                {
                    status: CampaignStatus.ACTIVE,
                },
            )

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: CampaignStatus.ACTIVE,
                reason: "START_DATE_REACHED",
                success: true,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "activateCampaign",
                campaignId: campaign.id,
                context: "cron-job",
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: campaign.status,
                reason: "ACTIVATION_FAILED",
                success: false,
                error: error.message,
            }
        }
    }

    private async completeCampaign(
        campaign: Campaign,
    ): Promise<StatusTransitionResult> {
        try {
            const targetReached =
                BigInt(campaign.receivedAmount) >= BigInt(campaign.targetAmount)
            const reason = targetReached
                ? "TARGET_AMOUNT_REACHED"
                : "END_DATE_REACHED"

            const updatedCampaign = await this.campaignRepository.update(
                campaign.id,
                {
                    status: CampaignStatus.COMPLETED,
                },
            )

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: CampaignStatus.COMPLETED,
                reason,
                success: true,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "completeCampaign",
                campaignId: campaign.id,
                context: "cron-job",
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: campaign.status,
                reason: "COMPLETION_FAILED",
                success: false,
                error: error.message,
            }
        }
    }

    private async handleExpiredCampaign(
        campaign: Campaign,
    ): Promise<StatusTransitionResult> {
        try {
            let newStatus: CampaignStatus
            let reason: string

            if (campaign.status === CampaignStatus.PENDING) {
                newStatus = CampaignStatus.REJECTED
                reason = "PENDING_EXPIRED"
            } else if (campaign.status === CampaignStatus.APPROVED) {
                newStatus = CampaignStatus.CANCELLED
                reason = "APPROVED_EXPIRED"
            } else {
                return {
                    campaignId: campaign.id,
                    oldStatus: campaign.status,
                    newStatus: campaign.status,
                    reason: "INVALID_STATUS_FOR_EXPIRATION",
                    success: false,
                    error: `Unexpected status: ${campaign.status}`,
                }
            }

            const updatedCampaign = await this.campaignRepository.update(
                campaign.id,
                {
                    status: newStatus,
                },
            )

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus,
                reason,
                success: true,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "handleExpiredCampaign",
                campaignId: campaign.id,
                context: "cron-job",
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: campaign.status,
                reason: "EXPIRATION_HANDLING_FAILED",
                success: false,
                error: error.message,
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
