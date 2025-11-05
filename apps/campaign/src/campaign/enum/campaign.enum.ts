import { registerEnumType } from "@nestjs/graphql"

export enum CampaignStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ACTIVE = "ACTIVE",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

registerEnumType(CampaignStatus, {
    name: "CampaignStatus",
    description: "Campaign fundraising status",
    valuesMap: {
        PENDING: {
            description: "Campaign created, waiting for admin approval",
        },
        APPROVED: {
            description: "Admin approved, waiting for fundraising_start_date",
        },
        REJECTED: {
            description: "Admin rejected campaign",
        },
        ACTIVE: {
            description: "Fundraising in progress",
        },
        PROCESSING: {
            description:
                "Fundraising ended, executing phases (cooking/delivery)",
        },
        COMPLETED: {
            description: "All phases completed successfully",
        },
        CANCELLED: {
            description: "Campaign cancelled by admin or creator",
        },
    },
})
