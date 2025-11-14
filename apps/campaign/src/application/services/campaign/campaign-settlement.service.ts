import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { PrismaClient } from "@app/campaign/src/generated/campaign-client"
import { UserClientService } from "@app/campaign/src/shared"
import { Injectable, Logger } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"

@Injectable()
export class CampaignSettlementService {
    private readonly logger = new Logger(CampaignSettlementService.name)

    constructor(
        private readonly prisma: PrismaClient,
        private readonly userClientService: UserClientService,
    ) {}

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

            // Verify campaign is still ACTIVE and has surplus
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

            // Execute settlement
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

        // Use transaction to ensure atomicity and prevent race conditions
        await this.prisma.$transaction(async (tx) => {
            // Step 1: Get fundraiser user ID from cognito_id
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

            // Step 2: Credit fundraiser wallet via gRPC
            this.logger.debug(
                `[SETTLEMENT] Step 2: Crediting fundraiser wallet for user ${fundraiserUser.id}`,
            )

            await this.userClientService.creditFundraiserWallet({
                fundraiserId: fundraiserUser.id,
                campaignId: campaign.id,
                paymentTransactionId: "", 
                amount: surplus, 
                gateway: "SYSTEM", 
                description: `Campaign surplus settlement: ${campaign.title} (Surplus: ${surplus.toString()} VND)`,
            })

            // Step 3: Update campaign status to COMPLETED
            this.logger.debug(
                "[SETTLEMENT] Step 3: Updating campaign status to COMPLETED",
            )

            await tx.campaign.update({
                where: { id: campaign.id },
                data: {
                    status: CampaignStatus.PROCESSING,
                    completed_at: new Date(),
                },
            })
        })

        this.logger.log(
            `[SETTLEMENT] ✅ Successfully settled campaign ${campaign.id} - ${surplus.toString()} VND transferred to fundraiser`,
        )
    }
}
