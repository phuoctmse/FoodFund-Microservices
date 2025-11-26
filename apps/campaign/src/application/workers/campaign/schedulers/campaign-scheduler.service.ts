import { Injectable, Logger } from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { JobExecutionResult } from "@libs/common/base/base.job"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { UserClientService } from "@app/campaign/src/shared"
import { CampaignRepository } from "../../../repositories/campaign.repository"

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
        private readonly userClientService: UserClientService,
    ) { }

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

    private async processCampaignBatch<
        T extends { id: string; status: CampaignStatus },
    >(
        campaigns: T[],
        processor: (campaign: T) => Promise<StatusTransitionResult>,
        operation: string,
    ): Promise<StatusTransitionResult[]> {
        if (campaigns.length === 0) {
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
    private async processSingleBatch<
        T extends { id: string; status: CampaignStatus },
    >(
        campaigns: T[],
        processor: (campaign: T) => Promise<StatusTransitionResult>,
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

    private async findApprovedCampaignsToActivate() {
        return this.campaignRepository.findApprovedCampaignsToActivateForJob(
            this.BATCH_CONFIG.maxCampaigns,
        )
    }

    private async findActiveCampaignsToComplete() {
        return this.campaignRepository.findActiveCampaignsToCompleteForJob(
            this.BATCH_CONFIG.maxCampaigns,
        )
    }

    private async findExpiredCampaigns() {
        return this.campaignRepository.findExpiredCampaignsForJob(
            this.BATCH_CONFIG.maxCampaigns,
        )
    }

    /**
     * Campaign processors with proper error handling
     */
    private async activateCampaign(
        campaign: Pick<Campaign, "id" | "status">,
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
        campaign: Pick<
            Campaign,
            | "id"
            | "status"
            | "receivedAmount"
            | "targetAmount"
            | "createdBy"
            | "title"
        >,
    ): Promise<StatusTransitionResult> {
        try {
            const receivedAmount = BigInt(campaign.receivedAmount || 0)
            const targetAmount = BigInt(campaign.targetAmount || 0)

            const fundingPercentage =
                targetAmount > 0n
                    ? (Number(receivedAmount) * 100) / Number(targetAmount)
                    : 0

            let newStatus: CampaignStatus
            let reason: string

            if (fundingPercentage >= 50) {
                newStatus = CampaignStatus.PROCESSING
                reason =
                    fundingPercentage >= 100
                        ? "FULL_FUNDING_REACHED"
                        : "PARTIAL_FUNDING_SUCCESS"

                this.logger.log(
                    `Campaign ${campaign.id} reached ${fundingPercentage.toFixed(2)}% funding - Moving to PROCESSING`,
                )
            } else {
                newStatus = CampaignStatus.ENDED
                reason = "INSUFFICIENT_FUNDING"

                this.logger.log(
                    `Campaign ${campaign.id} only reached ${fundingPercentage.toFixed(2)}% funding - Moving to ENDED and pooling funds`,
                )

                if (receivedAmount > 0n) {
                    await this.poolFundsToFundraiser(campaign)
                }
            }

            await this.campaignRepository.update(campaign.id, {
                status: newStatus,
                completedAt:
                    newStatus === CampaignStatus.ENDED ? new Date() : undefined,
            })

            return {
                campaignId: campaign.id,
                oldStatus: campaign.status,
                newStatus: newStatus,
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

    private async poolFundsToFundraiser(
        campaign: Pick<
            Campaign,
            "id" | "createdBy" | "title" | "receivedAmount" | "targetAmount"
        >,
    ): Promise<void> {
        try {
            const fundraiserUser =
                await this.userClientService.getUserByCognitoId(
                    campaign.createdBy,
                )

            if (!fundraiserUser) {
                throw new Error(
                    `Fundraiser user not found for cognito_id ${campaign.createdBy}`,
                )
            }

            // Credit fundraiser wallet with all received funds
            await this.userClientService.creditFundraiserWallet({
                fundraiserId: fundraiserUser.id,
                campaignId: campaign.id,
                paymentTransactionId: "",
                amount: BigInt(campaign.receivedAmount),
                gateway: "SYSTEM",
                description: `Quỹ chung từ chiến dịch "${campaign.title}" (Nhận được: ${campaign.receivedAmount.toString()} VND, Mục Tiêu: ${campaign.targetAmount.toString()} VND)`,
            })

            this.logger.log(
                `✅ Pooled ${campaign.receivedAmount.toString()} VND to fundraiser wallet for campaign ${campaign.id}`,
            )
        } catch (error) {
            this.logger.error(
                `Failed to pool funds for campaign ${campaign.id}:`,
                error,
            )
            throw error
        }
    }

    private async handleExpiredCampaign(
        campaign: Pick<Campaign, "id" | "status">,
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
