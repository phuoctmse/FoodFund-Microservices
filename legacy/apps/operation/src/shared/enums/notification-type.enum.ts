import { registerEnumType } from "@nestjs/graphql"

export enum NotificationType {
    CAMPAIGN_APPROVED = "CAMPAIGN_APPROVED",
    CAMPAIGN_REJECTED = "CAMPAIGN_REJECTED",
    CAMPAIGN_COMPLETED = "CAMPAIGN_COMPLETED",
    CAMPAIGN_CANCELLED = "CAMPAIGN_CANCELLED",
    CAMPAIGN_DONATION_RECEIVED = "CAMPAIGN_DONATION_RECEIVED",
    CAMPAIGN_NEW_POST = "CAMPAIGN_NEW_POST",
    CAMPAIGN_EXTENDED = "CAMPAIGN_EXTENDED",
    CAMPAIGN_PHASE_STATUS_UPDATED = "CAMPAIGN_PHASE_STATUS_UPDATED",
    CAMPAIGN_REASSIGNMENT_PENDING = "CAMPAIGN_REASSIGNMENT_PENDING",
    CAMPAIGN_OWNERSHIP_TRANSFERRED = "CAMPAIGN_OWNERSHIP_TRANSFERRED",
    CAMPAIGN_OWNERSHIP_RECEIVED = "CAMPAIGN_OWNERSHIP_RECEIVED",
    CAMPAIGN_REASSIGNMENT_EXPIRED = "CAMPAIGN_REASSIGNMENT_EXPIRED",

    POST_COMMENT = "POST_COMMENT",
    POST_REPLY = "POST_REPLY",
    POST_LIKE = "POST_LIKE",

    INGREDIENT_REQUEST_APPROVED = "INGREDIENT_REQUEST_APPROVED",
    INGREDIENT_REQUEST_REJECTED = "INGREDIENT_REQUEST_REJECTED",
    INGREDIENT_DISBURSEMENT_COMPLETED = "INGREDIENT_DISBURSEMENT_COMPLETED",
    COOKING_DISBURSEMENT_COMPLETED = "COOKING_DISBURSEMENT_COMPLETED",
    DELIVERY_DISBURSEMENT_COMPLETED = "DELIVERY_DISBURSEMENT_COMPLETED",

    EXPENSE_PROOF_APPROVED = "EXPENSE_PROOF_APPROVED",
    EXPENSE_PROOF_REJECTED = "EXPENSE_PROOF_REJECTED",
    COOKING_REQUEST_APPROVED = "COOKING_REQUEST_APPROVED",
    COOKING_REQUEST_REJECTED = "COOKING_REQUEST_REJECTED",
    DELIVERY_REQUEST_APPROVED = "DELIVERY_REQUEST_APPROVED",
    DELIVERY_REQUEST_REJECTED = "DELIVERY_REQUEST_REJECTED",

    DELIVERY_TASK_ASSIGNED = "DELIVERY_TASK_ASSIGNED",
    SURPLUS_TRANSFERRED = "SURPLUS_TRANSFERRED",

    SYSTEM_ANNOUNCEMENT = "SYSTEM_ANNOUNCEMENT",
}

registerEnumType(NotificationType, {
    name: "NotificationType",
    description: "Types of notifications in FoodFund system",
    valuesMap: {
        CAMPAIGN_APPROVED: {
            description: "Campaign has been approved by admin",
        },
        CAMPAIGN_REJECTED: {
            description: "Campaign has been rejected by admin",
        },
        CAMPAIGN_COMPLETED: {
            description: "Campaign has been completed",
        },
        CAMPAIGN_CANCELLED: {
            description: "Campaign has been cancelled",
        },
        CAMPAIGN_DONATION_RECEIVED: {
            description: "Campaign received new donations (grouped)",
        },
        CAMPAIGN_NEW_POST: {
            description: "New post published in campaign",
        },
        CAMPAIGN_EXTENDED: {
            description: "Campaign fundraising period extended",
        },
        CAMPAIGN_PHASE_STATUS_UPDATED: {
            description: "Campaign phase status updated by fundraiser",
        },
        POST_LIKE: {
            description: "Post received likes (grouped)",
        },
        POST_COMMENT: {
            description: "New comment on post",
        },
        POST_REPLY: {
            description: "Reply to comment",
        },
        INGREDIENT_REQUEST_APPROVED: {
            description:
                "Ingredient request has been approved by admin",
        },
        INGREDIENT_REQUEST_REJECTED: {
            description:
                "Ingredient request has been rejected by admin",
        },
        INGREDIENT_DISBURSEMENT_COMPLETED: {
            description: "Ingredient disbursement has been completed by admin",
        },
        COOKING_DISBURSEMENT_COMPLETED: {
            description: "Cooking disbursement has been completed by admin",
        },
        DELIVERY_DISBURSEMENT_COMPLETED: {
            description: "Delivery disbursement has been completed by admin",
        },
        DELIVERY_TASK_ASSIGNED: {
            description: "Delivery task assigned to staff",
        },
        SURPLUS_TRANSFERRED: {
            description: "Surplus funds transferred to fundraiser wallet",
        },
        EXPENSE_PROOF_APPROVED: {},
        EXPENSE_PROOF_REJECTED: {},
        COOKING_REQUEST_APPROVED: {
            description: "Cooking wage request has been approved by admin",
        },
        COOKING_REQUEST_REJECTED: {
            description: "Cooking wage request has been rejected by admin",
        },
        DELIVERY_REQUEST_APPROVED: {
            description: "Delivery wage request has been approved by admin",
        },
        DELIVERY_REQUEST_REJECTED: {
            description: "Delivery wage request has been rejected by admin",
        },
        SYSTEM_ANNOUNCEMENT: {
            description: "System-wide announcement",
        },
    },
})