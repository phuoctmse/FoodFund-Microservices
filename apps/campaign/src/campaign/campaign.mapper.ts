import { Injectable } from "@nestjs/common"
import { Campaign } from "@libs/databases/prisma/schemas/models/campaign.model"
import { CampaignStatus } from "@libs/databases/prisma/schemas/enums/campaign.enum"
import { Campaign_Status } from "@prisma/client"

/**
 * Database Campaign Model Interface
 * Represents the structure returned from Prisma queries
 */
export interface DatabaseCampaign {
    id: string
    title: string
    description: string
    cover_image: string
    cover_image_file_key?: string | null
    location: string
    target_amount: bigint
    donation_count: number
    received_amount: bigint
    status: Campaign_Status
    start_date: Date
    end_date: Date
    is_active: boolean
    created_by: string
    approved_at?: Date | null
    created_at: Date
    updated_at: Date
}

/**
 * Campaign Mapper Service
 * Handles conversion between database models and GraphQL schemas
 */
@Injectable()
export class CampaignMapper {
    /**
     * Maps Prisma Campaign_Status to GraphQL CampaignStatus
     */
    private mapStatusToGraphQL(prismaStatus: Campaign_Status): CampaignStatus {
        const statusMapping: Record<Campaign_Status, CampaignStatus> = {
            PENDING: CampaignStatus.PENDING,
            APPROVED: CampaignStatus.APPROVED,
            REJECTED: CampaignStatus.REJECTED,
            ACTIVE: CampaignStatus.ACTIVE,
            COMPLETED: CampaignStatus.COMPLETED,
            CANCELLED: CampaignStatus.CANCELLED,
        }
        return statusMapping[prismaStatus]
    }

    /**
     * Maps GraphQL CampaignStatus to Prisma Campaign_Status
     */
    private mapStatusToPrisma(graphqlStatus: CampaignStatus): Campaign_Status {
        const statusMapping: Record<CampaignStatus, Campaign_Status> = {
            [CampaignStatus.PENDING]: "PENDING",
            [CampaignStatus.APPROVED]: "APPROVED",
            [CampaignStatus.REJECTED]: "REJECTED",
            [CampaignStatus.ACTIVE]: "ACTIVE",
            [CampaignStatus.COMPLETED]: "COMPLETED",
            [CampaignStatus.CANCELLED]: "CANCELLED",
        }
        return statusMapping[graphqlStatus]
    }

    /**
     * Maps database campaign model to GraphQL Campaign schema
     * Creates plain object with proper __typename for GraphQL Federation
     */
    mapToGraphQLModel(dbCampaign: DatabaseCampaign): Campaign {
        const campaignData = {
            __typename: "Campaign" as const,
            id: dbCampaign.id,
            createdAt: dbCampaign.created_at,
            updatedAt: dbCampaign.updated_at,
            title: dbCampaign.title,
            description: dbCampaign.description,
            coverImage: dbCampaign.cover_image,
            coverImageFileKey: dbCampaign.cover_image_file_key || undefined,
            location: dbCampaign.location,
            targetAmount: dbCampaign.target_amount.toString(),
            donationCount: dbCampaign.donation_count,
            receivedAmount: dbCampaign.received_amount.toString(),
            status: this.mapStatusToGraphQL(dbCampaign.status),
            startDate: dbCampaign.start_date,
            endDate: dbCampaign.end_date,
            isActive: dbCampaign.is_active,
            createdBy: dbCampaign.created_by,
            approvedAt: dbCampaign.approved_at || undefined,
            creator: undefined,
            donations: undefined,
        }

        return campaignData as Campaign
    }

    /**
     * Maps array of database campaigns to GraphQL campaigns
     */
    mapArrayToGraphQLModel(dbCampaigns: DatabaseCampaign[]): Campaign[] {
        return dbCampaigns.map((campaign) => this.mapToGraphQLModel(campaign))
    }

    /**
     * Validates that required fields are present in database model
     */
    validateDatabaseModel(
        dbCampaign: any,
    ): asserts dbCampaign is DatabaseCampaign {
        const requiredFields = [
            "id",
            "title",
            "description",
            "cover_image",
            "location",
            "target_amount",
            "donation_count",
            "received_amount",
            "status",
            "start_date",
            "end_date",
            "is_active",
            "created_by",
            "created_at",
            "updated_at",
        ]

        const missingFields = requiredFields.filter(
            (field) =>
                dbCampaign[field] === undefined || dbCampaign[field] === null,
        )

        if (missingFields.length > 0) {
            throw new Error(
                `Database campaign missing required fields: ${missingFields.join(", ")}`,
            )
        }

        if (typeof dbCampaign.target_amount !== "bigint") {
            throw new Error("target_amount must be a BigInt")
        }

        if (typeof dbCampaign.received_amount !== "bigint") {
            throw new Error("received_amount must be a BigInt")
        }

        const validStatuses = Object.values(Campaign_Status)
        if (!validStatuses.includes(dbCampaign.status)) {
            throw new Error(`Invalid status: ${dbCampaign.status}`)
        }

        if (!(dbCampaign.start_date instanceof Date)) {
            throw new Error("start_date must be a Date")
        }

        if (!(dbCampaign.end_date instanceof Date)) {
            throw new Error("end_date must be a Date")
        }

        if (!(dbCampaign.created_at instanceof Date)) {
            throw new Error("created_at must be a Date")
        }

        if (!(dbCampaign.updated_at instanceof Date)) {
            throw new Error("updated_at must be a Date")
        }
    }

    /**
     * Safe mapping with validation
     */
    safeMapToGraphQLModel(dbCampaign: any): Campaign {
        this.validateDatabaseModel(dbCampaign)
        return this.mapToGraphQLModel(dbCampaign)
    }

    /**
     * Maps partial database campaign data for updates
     */
    mapPartialToGraphQLModel(
        dbCampaign: Partial<DatabaseCampaign>,
    ): Partial<Campaign> {
        const mappedData: any = {
            __typename: "Campaign",
        }

        if (dbCampaign.id !== undefined) mappedData.id = dbCampaign.id
        if (dbCampaign.title !== undefined) mappedData.title = dbCampaign.title
        if (dbCampaign.description !== undefined)
            mappedData.description = dbCampaign.description
        if (dbCampaign.cover_image !== undefined)
            mappedData.coverImage = dbCampaign.cover_image
        if (dbCampaign.cover_image_file_key !== undefined) {
            mappedData.coverImageFileKey =
                dbCampaign.cover_image_file_key || undefined
        }
        if (dbCampaign.location !== undefined)
            mappedData.location = dbCampaign.location
        if (dbCampaign.target_amount !== undefined) {
            mappedData.targetAmount = dbCampaign.target_amount.toString()
        }
        if (dbCampaign.donation_count !== undefined) {
            mappedData.donationCount = dbCampaign.donation_count
        }
        if (dbCampaign.received_amount !== undefined) {
            mappedData.receivedAmount = dbCampaign.received_amount.toString()
        }
        if (dbCampaign.status !== undefined) {
            mappedData.status = this.mapStatusToGraphQL(dbCampaign.status)
        }
        if (dbCampaign.start_date !== undefined)
            mappedData.startDate = dbCampaign.start_date
        if (dbCampaign.end_date !== undefined)
            mappedData.endDate = dbCampaign.end_date
        if (dbCampaign.is_active !== undefined)
            mappedData.isActive = dbCampaign.is_active
        if (dbCampaign.created_by !== undefined)
            mappedData.createdBy = dbCampaign.created_by
        if (dbCampaign.approved_at !== undefined) {
            mappedData.approvedAt = dbCampaign.approved_at || undefined
        }
        if (dbCampaign.created_at !== undefined)
            mappedData.createdAt = dbCampaign.created_at
        if (dbCampaign.updated_at !== undefined)
            mappedData.updatedAt = dbCampaign.updated_at

        return mappedData as Partial<Campaign>
    }

    /**
     * Helper method to convert GraphQL enum to Prisma enum for database operations
     */
    graphQLStatusToPrisma(status: CampaignStatus): Campaign_Status {
        return this.mapStatusToPrisma(status)
    }
}
