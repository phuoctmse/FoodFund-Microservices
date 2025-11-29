import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { PrismaClient } from "@app/campaign/src/generated/campaign-client"
import { UserClientService } from "@app/campaign/src/shared"
import { Injectable, Logger } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import * as crypto from "crypto"

@Injectable()
export class CampaignSettlementService {
    private readonly logger = new Logger(CampaignSettlementService.name)

    constructor(
        private readonly prisma: PrismaClient,
        private readonly userClientService: UserClientService,
    ) { }

    @OnEvent("campaign.surplus.detected")
    async handleSurplusDetected(payload: { campaignId: string; surplus: string }) {
        this.logger.log("===========================================")
        this.logger.log(
            `[EVENT] Surplus detected for campaign ${payload.campaignId}`,
        )
        this.logger.log(`[EVENT] Surplus amount: ${payload.surplus} VND`)
        this.logger.log("===========================================")

        try {
            // Fetch latest campaign data
            const campaign = await this.prisma.campaign.findUnique({
                where: { id: payload.campaignId },
                select: {
                    id: true,
                    title: true,
                    target_amount: true,
                    received_amount: true,
                    status: true,
                    created_by: true,
                },
            })

            if (!campaign) {
                this.logger.error(
                    `[EVENT] Campaign ${payload.campaignId} not found`,
                )
                return
            }

            if (campaign.status !== CampaignStatus.ACTIVE) {
                this.logger.warn(
                    `[EVENT] Campaign ${payload.campaignId} is not ACTIVE (status: ${campaign.status}). Skipping settlement.`,
                )
                return
            }

            if (campaign.received_amount <= campaign.target_amount) {
                this.logger.warn(
                    `[EVENT] Campaign ${payload.campaignId} no longer has surplus. Skipping settlement.`,
                )
                return
            }

            await this.settleCampaignSurplus(campaign)

            this.logger.log("===========================================")
            this.logger.log(
                `[EVENT] ✅ Settlement completed for campaign ${payload.campaignId}`,
            )
            this.logger.log("===========================================")
        } catch (error) {
            this.logger.error(
                `[EVENT] ❌ Failed to settle campaign ${payload.campaignId}: ${error.message}`,
                error.stack,
            )
        }
    }

    async settleCampaignSurplus(campaign: any) {
        const surplus = BigInt(campaign.received_amount) - BigInt(campaign.target_amount)

        this.logger.log(
            `[SETTLEMENT] Processing campaign "${campaign.title}" (ID: ${campaign.id})`,
        )
        this.logger.log(
            `  - Target: ${campaign.target_amount.toString()} VND`,
        )
        this.logger.log(
            `  - Received: ${campaign.received_amount.toString()} VND`,
        )
        this.logger.log(`  - Surplus: ${surplus.toString()} VND`)

        await this.prisma.$transaction(async (tx) => {
            this.logger.debug(
                `[SETTLEMENT] Step 1: Getting fundraiser user ID for cognito_id ${campaign.created_by}`,
            )

            const fundraiserUser = await this.userClientService.getUserByCognitoId(campaign.created_by)
            if (!fundraiserUser) {
                throw new Error(`Fundraiser user not found for cognito_id ${campaign.created_by}`)
            }

            this.logger.debug(
                `[SETTLEMENT] Found fundraiser user ID: ${fundraiserUser.id}`,
            )

            // Step 2: Update campaign status to COMPLETED
            // IMPORTANT: Add status: ACTIVE to where clause to prevent race conditions
            this.logger.debug(
                "[SETTLEMENT] Step 2: Updating campaign status to COMPLETED",
            )

            try {
                await tx.campaign.update({
                    where: {
                        id: campaign.id,
                        status: CampaignStatus.ACTIVE
                    },
                    data: {
                        status: CampaignStatus.PROCESSING,
                        changed_status_at: new Date(),
                        updated_at: new Date(),
                        previous_status: CampaignStatus.ACTIVE
                    },
                })
            } catch (error) {
                if (error.code === "P2025") {
                    this.logger.warn(`[SETTLEMENT] Campaign ${campaign.id} is no longer ACTIVE. Skipping settlement to prevent duplicate.`)
                    return
                }
                throw error
            }

            this.logger.debug(
                "[SETTLEMENT] Step 3: Creating Outbox Event for Surplus Settlement",
            )

            const settlementId = crypto.randomUUID()

            await tx.outboxEvent.create({
                data: {
                    aggregate_id: campaign.id,
                    event_type: "CAMPAIGN_SURPLUS_SETTLED",
                    payload: {
                        campaignId: campaign.id,
                        campaignTitle: campaign.title,
                        fundraiserId: fundraiserUser.id,
                        surplus: surplus.toString(),
                        timestamp: new Date(),
                        settlementId: settlementId,
                    },
                    status: "PENDING",
                },
            })
        }, {
            timeout: 20000
        })

        this.logger.log(
            `[SETTLEMENT] ✅ Successfully settled campaign ${campaign.id} - ${surplus.toString()} VND transferred to fundraiser`,
        )
    }
}
