import { registerEnumType } from "@nestjs/graphql"

export enum CampaignStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ACTIVE = "ACTIVE",
    AWAITING_DISBURSEMENT = "AWAITING_DISBURSEMENT",
    FUNDS_DISBURSED = "FUNDS_DISBURSED",
    INGREDIENT_PURCHASE = "INGREDIENT_PURCHASE",
    COOKING = "COOKING",
    DELIVERY = "DELIVERY",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

registerEnumType(CampaignStatus, {
    name: "CampaignStatus",
    description: "Campaign status in the system",
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
        AWAITING_DISBURSEMENT: {
            description:
                "Target reached or end date passed, waiting for admin to disburse funds",
        },
        FUNDS_DISBURSED: {
            description: "Admin disbursed funds to fundraiser's account",
        },
        INGREDIENT_PURCHASE: {
            description: "Kitchen staff purchasing ingredients",
        },
        COOKING: {
            description: "Kitchen staff preparing meals",
        },
        DELIVERY: {
            description: "Delivery staff distributing meals",
        },
        COMPLETED: {
            description: "All stages completed successfully",
        },
        CANCELLED: {
            description: "Campaign cancelled",
        },
    },
})
