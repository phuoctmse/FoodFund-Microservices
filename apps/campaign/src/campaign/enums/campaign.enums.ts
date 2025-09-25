import { registerEnumType } from "@nestjs/graphql"

export enum CampaignStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
}

registerEnumType(CampaignStatus, {
    name: "CampaignStatus",
    description: "Campaign status in the system",
})
