import { registerEnumType } from "@nestjs/graphql"

export enum CampaignPhaseStatus {
    PLANNING = "PLANNING",
    AWAITING_DISBURSEMENT = "AWAITING_DISBURSEMENT",
    INGREDIENT_PURCHASE = "INGREDIENT_PURCHASE",
    COOKING = "COOKING",
    DELIVERY = "DELIVERY",
    AWAITING_AUDIT = "AWAITING_AUDIT",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    FAILED = "FAILED",
}

registerEnumType(CampaignPhaseStatus, {
    name: "CampaignPhaseStatus",
    description: "The status of a campaign execution phase",
})
