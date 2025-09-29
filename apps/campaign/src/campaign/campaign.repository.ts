import { SentryService } from "@libs/observability/sentry.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    UpdateCampaignInput,
} from "./dtos/request/campaign.input"
import { PrismaClient } from "@prisma/client"
import { Injectable, Logger } from "@nestjs/common"
import { CampaignStatus } from "@libs/databases/prisma/schemas/enums/campaign.enum"
import { Campaign } from "@libs/databases/prisma/schemas/models/campaign.model"
import { CampaignMapper } from "./campaign.mapper"

export interface FindManyOptions {
    filter?: CampaignFilterInput
    search?: string
    sortBy?: CampaignSortOrder
    limit?: number
    offset?: number
}

interface CreateCampaignData {
    title: string
    description: string
    coverImage: string
    location: string
    targetAmount: string
    startDate: Date
    endDate: Date
    createdBy: string
    status: CampaignStatus
    coverImageFileKey?: string
}

interface UpdateCampaignData extends Partial<UpdateCampaignInput> {
    coverImage?: string
    status?: CampaignStatus
    approvedAt?: Date
    coverImageFileKey?: string
}

@Injectable()
export class CampaignRepository {
    private readonly logger = new Logger(CampaignRepository.name)

    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
        private readonly campaignMapper: CampaignMapper,
    ) {}

    async create(data: CreateCampaignData): Promise<Campaign> {
        try {
            const campaign = await this.prisma.campaign.create({
                data: {
                    title: data.title,
                    description: data.description,
                    cover_image: data.coverImage,
                    cover_image_file_key: data.coverImageFileKey || null,
                    location: data.location,
                    target_amount: BigInt(data.targetAmount),
                    start_date: data.startDate,
                    end_date: data.endDate,
                    created_by: data.createdBy,
                    status: this.campaignMapper.graphQLStatusToPrisma(
                        data.status,
                    ) as any,
                    donation_count: 0,
                    received_amount: BigInt(0),
                    is_active: true,
                },
            })

            return this.campaignMapper.safeMapToGraphQLModel(campaign)
        } catch (error) {
            this.logger.error("Failed to create campaign:", error)
            this.sentryService.captureError(error as Error, {
                operation: "createCampaign",
                data: {
                    title: data.title,
                    hasFileKey: !!data.coverImageFileKey,
                    createdBy: data.createdBy,
                    status: data.status,
                },
            })
            throw error
        }
    }

    async findById(id: string): Promise<Campaign | null> {
        try {
            const campaign = await this.prisma.campaign.findUnique({
                where: { id },
            })

            return campaign
                ? this.campaignMapper.safeMapToGraphQLModel(campaign)
                : null
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
        const {
            filter,
            search,
            sortBy = CampaignSortOrder.ACTIVE_FIRST,
            limit = 10,
            offset = 0,
        } = options

        try {
            const whereClause: any = {
                AND: [],
            }

            if (filter?.status && filter.status.length > 0) {
                const prismaStatuses = filter.status.map((status) =>
                    this.campaignMapper.graphQLStatusToPrisma(status),
                )
                whereClause.AND.push({
                    status: {
                        in: prismaStatuses,
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

            const campaigns = await this.prisma.campaign.findMany({
                where: whereClause.AND.length > 0 ? whereClause : undefined,
                orderBy: this.buildOrderByClause(sortBy),
                take: Math.min(limit, 100),
                skip: offset,
            })

            return this.campaignMapper.mapArrayToGraphQLModel(campaigns)
        } catch (error) {
            this.logger.error("Failed to find campaigns:", error)
            this.sentryService.captureError(error as Error, {
                operation: "findManyCampaigns",
                filterData: filter,
                searchTerm: search,
                sortOrder: sortBy,
                limitValue: limit,
                offsetValue: offset,
                originalOptions: options,
            })
            throw error
        }
    }

    async update(id: string, data: UpdateCampaignData): Promise<Campaign> {
        try {
            const updateData: any = {}

            if (data.title !== undefined) updateData.title = data.title
            if (data.description !== undefined)
                updateData.description = data.description
            if (data.coverImage !== undefined)
                updateData.cover_image = data.coverImage
            if (data.coverImageFileKey !== undefined)
                updateData.cover_image_file_key = data.coverImageFileKey
            if (data.location !== undefined) updateData.location = data.location
            if (data.targetAmount !== undefined)
                updateData.target_amount = BigInt(data.targetAmount)
            if (data.startDate !== undefined)
                updateData.start_date = data.startDate
            if (data.endDate !== undefined) updateData.end_date = data.endDate
            if (data.status !== undefined)
                updateData.status = this.campaignMapper.graphQLStatusToPrisma(
                    data.status,
                )
            if (data.approvedAt !== undefined)
                updateData.approved_at = data.approvedAt

            const campaign = await this.prisma.campaign.update({
                where: { id },
                data: updateData,
            })

            return this.campaignMapper.safeMapToGraphQLModel(campaign)
        } catch (error) {
            this.logger.error(`Failed to update campaign ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaign",
                campaignId: id,
                data: {
                    hasFileKey: !!data.coverImageFileKey,
                    updateFields: Object.keys(data),
                },
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
                const prismaStatuses = filter.status.map((status) =>
                    this.campaignMapper.graphQLStatusToPrisma(status),
                )
                whereClause.AND.push({
                    status: {
                        in: prismaStatuses,
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
            return [
                { status: "asc" },
                { created_at: "desc" },
            ]
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
