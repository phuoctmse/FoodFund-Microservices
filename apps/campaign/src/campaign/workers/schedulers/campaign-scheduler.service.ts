import { Injectable, Logger } from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { JobExecutionResult } from "@libs/common/base/base.job"
import { Campaign } from "../../models/campaign.model"
import { CampaignRepository } from "../../repository"
import { CampaignStatus } from "../../enum"

export interface StatusTransitionResult {
    campaignId: string
    oldStatus: CampaignStatus
    newStatus: CampaignStatus
    reason: string
    success: boolean
    error?: string
}

export interface CampaignBatchConfig {
    batchSize: number
    delayBetweenBatches: number
    maxCampaigns: number
}

@Injectable()
export class CampaignSchedulerService {
    private readonly logger = new Logger(CampaignSchedulerService.name)

    private readonly BATCH_CONFIG: CampaignBatchConfig = {
        batchSize: 20,
        delayBetweenBatches: 50,
        maxCampaigns: 1000,
    }

    constructor(
        private readonly campaignRepository: CampaignRepository,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Activate approved campaigns that have reached their fundraising start date
     */
    async activateApprovedCampaigns(): Promise<JobExecutionResult> {
        return this.executeJobWithProfiling(
            "ACTIVATE_APPROVED_CAMPAIGNS",
            async () => {
                const campaigns = await this.findApprovedCampaignsToActivate()
                return this.processCampaignBatch(
                    campaigns,
                    this.activateCampaign.bind(this),
                    "ACTIVATION",
                )
            },
        )
    }

    /**
     * Move active campaigns to AWAITING_DISBURSEMENT when they reach end date or target
     */
    async completeActiveCampaigns(): Promise<JobExecutionResult> {
        return this.executeJobWithProfiling(
            "COMPLETE_ACTIVE_CAMPAIGNS",
            async () => {
                const campaigns = await this.findActiveCampaignsToComplete()
                return this.processCampaignBatch(
                    campaigns,
                    this.completeCampaign.bind(this),
                    "COMPLETION",
                )
            },
        )
    }

    /**
     * Handle expired campaigns (PENDING -> REJECTED, APPROVED -> CANCELLED)
     */
    async handleExpiredCampaigns(): Promise<JobExecutionResult> {
        return this.executeJobWithProfiling(
            "HANDLE_EXPIRED_CAMPAIGNS",
            async () => {
                const campaigns = await this.findExpiredCampaigns()
                return this.processCampaignBatch(
                    campaigns,
                    this.handleExpiredCampaign.bind(this),
                    "EXPIRATION",
                )
            },
        )
    }

    /**
     * Execute job with performance profiling and error handling
     */
    private async executeJobWithProfiling(
        jobName: string,
        processor: () => Promise<StatusTransitionResult[]>,
    ): Promise<JobExecutionResult> {
        const startTime = Date.now()
        let results: StatusTransitionResult[] = []

        try {
            results = await processor()

            const executionTime = Date.now() - startTime
            const successCount = results.filter((r) => r.success).length
            const failureCount = results.filter((r) => !r.success).length

            this.logger.log(
                `${jobName}: ${successCount} success, ${failureCount} failed in ${executionTime}ms`,
            )

            return {
                jobName,
                totalProcessed: results.length,
                successCount,
                failureCount,
                results: results.map((r) => ({
                    success: r.success,
                    campaignId: r.campaignId,
                    error: r.error,
                    reason: r.reason,
                })),
                executionTime,
                timestamp: new Date(),
            }
        } catch (error) {
            this.logger.error(`${jobName} failed completely:`, error)
            this.sentryService.captureError(error as Error, {
                operation: jobName.toLowerCase(),
                context: "campaign-scheduler",
            })
            throw error
        }
    }

    private async processCampaignBatch(
        campaigns: Campaign[],
        processor: (campaign: Campaign) => Promise<StatusTransitionResult>,
        operation: string,
    ): Promise<StatusTransitionResult[]> {
        if (campaigns.length === 0) {
            this.logger.debug(`No campaigns found for ${operation}`)
            return []
        }

        this.logger.log(
            `Processing ${campaigns.length} campaigns for ${operation}`,
        )

        const limitedCampaigns = campaigns.slice(
            0,
            this.BATCH_CONFIG.maxCampaigns,
        )
        if (limitedCampaigns.length < campaigns.length) {
            this.logger.warn(
                `Limited campaigns from ${campaigns.length} to ${limitedCampaigns.length} for safety`,
            )
        }

        const results: StatusTransitionResult[] = []
        const { batchSize, delayBetweenBatches } = this.BATCH_CONFIG

        for (let i = 0; i < limitedCampaigns.length; i += batchSize) {
            const batch = limitedCampaigns.slice(i, i + batchSize)
            const batchResults = await this.processSingleBatch(
                batch,
                processor,
                operation,
            )

            results.push(...batchResults)

            if (i + batchSize < limitedCampaigns.length) {
                await this.delay(delayBetweenBatches)
            }
        }

        return results
    }

    /**
     * Process single batch with proper concurrency control
     */
    private async processSingleBatch(
        campaigns: Campaign[],
        processor: (campaign: Campaign) => Promise<StatusTransitionResult>,
        operation: string,
    ): Promise<StatusTransitionResult[]> {
        const batchPromises = campaigns.map(async (campaign, index) => {
            try {
                if (index > 0) {
                    await this.delay(index * 10)
                }

                return await processor(campaign)
            } catch (error) {
                this.logger.error(
                    `${operation} - Campaign ${campaign.id} failed:`,
                    error,
                )

                return {
                    campaignId: campaign.id,
                    oldStatus: campaign.status,
                    newStatus: campaign.status,
                    reason: `${operation}_PROCESSING_ERROR`,
                    success: false,
                    error: error.message,
                }
            }
        })

        const settledResults = await Promise.allSettled(batchPromises)

        return settledResults.map((result, index) => {
            if (result.status === "fulfilled") {
                return result.value
            } else {
                const campaign = campaigns[index]
                return {
                    campaignId: campaign.id,
                    oldStatus: campaign.status,
                    newStatus: campaign.status,
                    reason: `${operation}_PROMISE_REJECTED`,
                    success: false,
                    error: result.reason?.message || "Promise rejected",
                }
            }
        })
    }

    /**
     * Find campaigns ready for activation with optimized query
     */
    private async findApprovedCampaignsToActivate(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const campaigns = await this.campaignRepository.findMany({
            filter: { status: [CampaignStatus.APPROVED] },
            limit: this.BATCH_CONFIG.maxCampaigns,
        })

        return campaigns.filter((campaign) => {
            const startDate = new Date(campaign.fundraisingStartDate)
            startDate.setHours(0, 0, 0, 0)
            return startDate <= today
        })
    }

    /**
     * Find campaigns ready for completion (move to AWAITING_DISBURSEMENT)
     */
    private async findActiveCampaignsToComplete(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        const campaigns = await this.campaignRepository.findMany({
            filter: { status: [CampaignStatus.ACTIVE] },
            limit: this.BATCH_CONFIG.maxCampaigns,
        })

        return campaigns.filter((campaign) => {
            const endDate = new Date(campaign.fundraisingEndDate)
            endDate.setHours(23, 59, 59, 999)

            const targetReached =
                BigInt(campaign.receivedAmount) >= BigInt(campaign.targetAmount)
            const dateExpired = endDate <= today

            return targetReached || dateExpired
        })
    }

    /**
     * Find expired campaigns
     */
    private async findExpiredCampaigns(): Promise<Campaign[]> {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        const campaigns = await this.campaignRepository.findMany({
            filter: {
                status: [CampaignStatus.PENDING, CampaignStatus.APPROVED],
            },
            limit: this.BATCH_CONFIG.maxCampaigns,
        })

        return campaigns.filter((campaign) => {
            const endDate = new Date(campaign.fundraisingEndDate)
            endDate.setHours(23, 59, 59, 999)
            return endDate <= today
        })
    }

    /**
     * Campaign processors with proper error handling
     */
    private async activateCampaign(
        campaign: Campaign,
    ): Promise<StatusTransitionResult> {
        try {
            await this.campaignRepository.update(campaign.id, {
                status: CampaignStatus.ACTIVE,
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: CampaignStatus.ACTIVE,
                reason: "FUNDRAISING_START_DATE_REACHED",
                success: true,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "activateCampaign",
                campaignId: campaign.id,
                context: "campaign-scheduler",
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
                : "FUNDRAISING_END_DATE_REACHED"

            await this.campaignRepository.update(campaign.id, {
                status: CampaignStatus.PROCESSING,
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: CampaignStatus.PROCESSING,
                reason,
                success: true,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "completeCampaign",
                campaignId: campaign.id,
                context: "campaign-scheduler",
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

            await this.campaignRepository.update(campaign.id, {
                status: newStatus,
            })

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
                context: "campaign-scheduler",
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

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
