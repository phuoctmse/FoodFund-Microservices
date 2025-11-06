import { registerEnumType } from "@nestjs/graphql"

export enum CampaignPhaseStatus {
    PLANNING = "PLANNING",
    AWAITING_INGREDIENT_DISBURSEMENT = "AWAITING_INGREDIENT_DISBURSEMENT",
    INGREDIENT_PURCHASE = "INGREDIENT_PURCHASE",
    AWAITING_AUDIT = "AWAITING_AUDIT",
    AWAITING_COOKING_DISBURSEMENT = "AWAITING_COOKING_DISBURSEMENT",
    COOKING = "COOKING",
    AWAITING_DELIVERY_DISBURSEMENT = "AWAITING_DELIVERY_DISBURSEMENT",
    DELIVERY = "DELIVERY",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    FAILED = "FAILED",
}

registerEnumType(CampaignPhaseStatus, {
    name: "CampaignPhaseStatus",
    description: "The status of a campaign execution phase",
})
