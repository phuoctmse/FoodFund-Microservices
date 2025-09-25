import { SentryService } from "@libs/observability/sentry.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    UpdateCampaignInput,
} from "./dtos/campaign.input"
import { CampaignStatus } from "./enums/campaign.enums"
import { Campaign } from "./models/campaign.model"
import { PrismaClient } from "@prisma/client"
import { Injectable, Logger } from "@nestjs/common"

export interface FindManyOptions {
    filter?: CampaignFilterInput
    search?: string
    sortBy?: CampaignSortOrder
    limit?: number
    offset?: number
}

@Injectable()
export class CampaignRepository {
    private readonly logger = new Logger(CampaignRepository.name)

    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(
        data: CreateCampaignInput & {
            createdBy: string
            status: CampaignStatus
        },
    ): Promise<Campaign> {
        try {
            const campaign = await this.prisma.campaign.create({
                data: {
                    title: data.title,
                    description: data.description,
                    cover_image: data.coverImage,
                    location: data.location,
                    target_amount: BigInt(data.targetAmount),
                    start_date: data.startDate,
                    end_date: data.endDate,
                    created_by: data.createdBy,
                    status: data.status,
                    donation_count: 0,
                    received_amount: BigInt(0),
                    is_active: true,
                },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    cover_image: true,
                    location: true,
                    target_amount: true,
                    donation_count: true,
                    received_amount: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                    is_active: true,
                    created_by: true,
                    approved_at: true,
                    created_at: true,
                    updated_at: true,
                },
            })

            return this.mapToGraphQLModel(campaign)
        } catch (error) {
            this.logger.error("Failed to create campaign:", error)
            this.sentryService.captureError(error as Error, {
                operation: "createCampaign",
                data,
            })
            throw error
        }
    }

    async findById(id: string): Promise<Campaign | null> {
        try {
            const campaign = await this.prisma.campaign.findUnique({
                where: { id },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    cover_image: true,
                    location: true,
                    target_amount: true,
                    donation_count: true,
                    received_amount: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                    is_active: true,
                    created_by: true,
                    approved_at: true,
                    created_at: true,
                    updated_at: true,
                },
            })

            return campaign ? this.mapToGraphQLModel(campaign) : null
        } catch (error) {
            this.logger.error(`Failed to find campaign by ID ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "findCampaignById",
                campaignId: id,
            })
            throw error
        }
    }

    async findMany(options: FindManyOptions): Promise<Campaign[]> {
        try {
            const {
                filter,
                search,
                sortBy = CampaignSortOrder.ACTIVE_FIRST,
                limit = 10,
                offset = 0,
            } = options

            const whereClause: any = {
                AND: [],
            }

            if (filter?.status && filter.status.length > 0) {
                whereClause.AND.push({
                    status: {
                        in: filter.status,
                    },
                })
            }

            if (filter?.creatorId) {
                whereClause.AND.push({
                    created_by: filter.creatorId,
                })
            }

            if (search) {
                whereClause.AND.push({
                    OR: [
                        {
                            title: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            description: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            location: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                    ],
                })
            }

            const orderBy = this.buildOrderByClause(sortBy)

            const campaigns = await this.prisma.campaign.findMany({
                where: whereClause.AND.length > 0 ? whereClause : undefined,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    cover_image: true,
                    location: true,
                    target_amount: true,
                    donation_count: true,
                    received_amount: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                    is_active: true,
                    created_by: true,
                    approved_at: true,
                    created_at: true,
                    updated_at: true,
                },
                orderBy,
                take: Math.min(limit, 100),
                skip: offset,
            })

            return campaigns.map((campaign) => this.mapToGraphQLModel(campaign))
        } catch (error) {
            this.logger.error("Failed to find campaigns:", error)
            this.sentryService.captureError(error as Error, {
                operation: "findManyCampaigns",
                options,
            })
            throw error
        }
    }

    async update(
        id: string,
        data: Partial<UpdateCampaignInput> & {
            status?: CampaignStatus
            approvedAt?: Date
        },
    ): Promise<Campaign> {
        try {
            const updateData: any = {}

            if (data.title !== undefined) updateData.title = data.title
            if (data.description !== undefined)
                updateData.description = data.description
            if (data.coverImage !== undefined)
                updateData.cover_image = data.coverImage
            if (data.location !== undefined) updateData.location = data.location
            if (data.targetAmount !== undefined)
                updateData.target_amount = BigInt(data.targetAmount)
            if (data.startDate !== undefined)
                updateData.start_date = data.startDate
            if (data.endDate !== undefined) updateData.end_date = data.endDate
            if (data.status !== undefined) updateData.status = data.status
            if (data.approvedAt !== undefined)
                updateData.approved_at = data.approvedAt

            const campaign = await this.prisma.campaign.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    cover_image: true,
                    location: true,
                    target_amount: true,
                    donation_count: true,
                    received_amount: true,
                    status: true,
                    start_date: true,
                    end_date: true,
                    is_active: true,
                    created_by: true,
                    approved_at: true,
                    created_at: true,
                    updated_at: true,
                },
            })

            return this.mapToGraphQLModel(campaign)
        } catch (error) {
            this.logger.error(`Failed to update campaign ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaign",
                campaignId: id,
                data,
            })
            throw error
        }
    }

    async count(
        filter?: CampaignFilterInput,
        search?: string,
    ): Promise<number> {
        try {
            const whereClause: any = {
                AND: [],
            }

            if (filter?.status && filter.status.length > 0) {
                whereClause.AND.push({
                    status: {
                        in: filter.status,
                    },
                })
            }

            if (filter?.creatorId) {
                whereClause.AND.push({
                    created_by: filter.creatorId,
                })
            }

            if (search) {
                whereClause.AND.push({
                    OR: [
                        { title: { contains: search, mode: "insensitive" } },
                        {
                            description: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        { location: { contains: search, mode: "insensitive" } },
                    ],
                })
            }

            return await this.prisma.campaign.count({
                where: whereClause.AND.length > 0 ? whereClause : undefined,
            })
        } catch (error) {
            this.logger.error("Failed to count campaigns:", error)
            this.sentryService.captureError(error as Error, {
                operation: "countCampaigns",
                filter,
                search,
            })
            throw error
        }
    }

    private buildOrderByClause(sortBy: CampaignSortOrder): any {
        switch (sortBy) {
        case CampaignSortOrder.ACTIVE_FIRST:
            return [{ status: "desc" }, { created_at: "desc" }]
        case CampaignSortOrder.NEWEST_FIRST:
            return { created_at: "desc" }
        case CampaignSortOrder.OLDEST_FIRST:
            return { created_at: "asc" }
        case CampaignSortOrder.TARGET_AMOUNT_ASC:
            return { target_amount: "asc" }
        case CampaignSortOrder.TARGET_AMOUNT_DESC:
            return { target_amount: "desc" }
        default:
            return { created_at: "desc" }
        }
    }

    private mapToGraphQLModel(dbCampaign: any): Campaign {
        return {
            id: dbCampaign.id,
            title: dbCampaign.title,
            description: dbCampaign.description,
            coverImage: dbCampaign.cover_image,
            location: dbCampaign.location,
            targetAmount: dbCampaign.target_amount.toString(),
            donationCount: dbCampaign.donation_count,
            receivedAmount: dbCampaign.received_amount.toString(),
            status: dbCampaign.status as CampaignStatus,
            startDate: dbCampaign.start_date,
            endDate: dbCampaign.end_date,
            isActive: dbCampaign.is_active,
            createdBy: dbCampaign.created_by,
            approvedAt: dbCampaign.approved_at,
            createdAt: dbCampaign.created_at,
            updatedAt: dbCampaign.updated_at,
        }
    }

    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        try {
            await this.prisma.$queryRaw`SELECT 1 as health_check`
            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "databaseHealthCheck",
                service: "campaign-repository",
                database: "postgresql",
            })

            throw new Error(`Database health check failed: ${error.message}`)
        }
    }
}
