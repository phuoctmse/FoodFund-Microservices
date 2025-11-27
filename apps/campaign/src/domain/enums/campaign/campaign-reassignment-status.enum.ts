import { registerEnumType } from "@nestjs/graphql"

export enum CampaignReassignmentStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
}

registerEnumType(CampaignReassignmentStatus, {
    name: "ReassignmentStatus",
    description: "Status of campaign reassignment request",
    valuesMap: {
        PENDING: { description: "Waiting for fundraiser response" },
        APPROVED: { description: "Fundraiser accepted the reassignment" },
        REJECTED: { description: "Fundraiser declined the reassignment" },
        EXPIRED: { description: "7 days passed without response" },
        CANCELLED: { description: "Admin cancelled the assignment" },
    },
})