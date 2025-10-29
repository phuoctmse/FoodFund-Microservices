import { Injectable, Logger } from "@nestjs/common"
import { CampaignService } from "../../campaign.service"

@Injectable()
export class CampaignCommonGrpcService {
    private readonly logger = new Logger(CampaignCommonGrpcService.name)

    constructor(private readonly campaignService: CampaignService) {}

    // Get campaign by ID
    async getCampaign(call: any, callback: any) {
        try {
            const { id } = call.request

            if (!id) {
                return callback(null, {
                    success: false,
                    campaign: null,
                    error: "Campaign ID is required",
                })
            }

            const campaign = await this.campaignService.findCampaignById(id)

            if (!campaign) {
                return callback(null, {
                    success: false,
                    campaign: null,
                    error: "Campaign not found",
                })
            }

            callback(null, {
                success: true,
                campaign: {
                    id: campaign.id,
                    title: campaign.title,
                    description: campaign.description || "",
                    cover_image: campaign.coverImage || "",
                    location: campaign.location || "",
                    target_amount: campaign.targetAmount.toString(),
                    donation_count: campaign.donationCount || 0,
                    received_amount: campaign.receivedAmount?.toString() || "0",
                    status: campaign.status,
                    fundraising_start_date: campaign.fundraisingStartDate?.toISOString() || "",
                    fundraising_end_date: campaign.fundraisingEndDate?.toISOString() || "",
                    is_active: campaign.isActive,
                    created_by: campaign.createdBy,
                    created_at: campaign.created_at.toISOString(),
                    updated_at: campaign.updated_at.toISOString(),
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Error getting campaign:", error)
            callback(null, {
                success: false,
                campaign: null,
                error: error.message || "Failed to get campaign",
            })
        }
    }
}
