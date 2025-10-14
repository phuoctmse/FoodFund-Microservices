import { SentryService } from "@libs/observability/sentry.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
} from "./dtos/request/campaign.input"
import { Injectable, Logger } from "@nestjs/common"
import { sanitizeSearchTerm } from "@libs/common/utils/sanitize-search-term.util"
import { PrismaClient } from "../generated/campaign-client"
import { Decimal } from "@prisma/client/runtime/library"
import { CampaignStatus } from "./enum/campaign.enum"
import { User } from "../shared/model/user.model"

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
    ingredientBudgetPercentage: Decimal
    cookingBudgetPercentage: Decimal
    deliveryBudgetPercentage: Decimal
    fundraisingStartDate: Date
    fundraisingEndDate: Date
    ingredientPurchaseDate: Date
    cookingDate: Date
    deliveryDate: Date
    createdBy: string
    status: CampaignStatus
    coverImageFileKey?: string
    categoryId?: string
}

interface UpdateCampaignData {
    title?: string
    description?: string
    coverImage?: string
    coverImageFileKey?: string
    location?: string
    targetAmount?: string
    ingredientBudgetPercentage?: Decimal
    cookingBudgetPercentage?: Decimal
    deliveryBudgetPercentage?: Decimal
    fundraisingStartDate?: Date
    fundraisingEndDate?: Date
    ingredientPurchaseDate?: Date
    cookingDate?: Date
    deliveryDate?: Date
    status?: CampaignStatus
    approvedAt?: Date
    completedAt?: Date
    fundsDisbursedAt?: Date
    ingredientFundsAmount?: bigint
    cookingFundsAmount?: bigint
    deliveryFundsAmount?: bigint
    categoryId?: string
}

@Injectable()
export class CampaignRepository {
    private readonly logger = new Logger(CampaignRepository.name)
    private readonly CAMPAIGN_JOIN_FIELDS = {
        category: {
            where: {
                is_active: true,
            },
            select: {
                id: true,
                title: true,
                description: true,
                is_active: true,
                created_at: true,
                updated_at: true,
            },
        },
    } as const

    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(data: CreateCampaignData) {
        try {
            const campaign = await this.prisma.campaign.create({
                data: {
                    title: data.title,
                    description: data.description,
                    cover_image: data.coverImage,
                    cover_image_file_key: data.coverImageFileKey || null,
                    location: data.location,
                    target_amount: BigInt(data.targetAmount),
                    ingredient_budget_percentage:
                        data.ingredientBudgetPercentage,
                    cooking_budget_percentage: data.cookingBudgetPercentage,
                    delivery_budget_percentage: data.deliveryBudgetPercentage,
                    fundraising_start_date: data.fundraisingStartDate,
                    fundraising_end_date: data.fundraisingEndDate,
                    ingredient_purchase_date: data.ingredientPurchaseDate,
                    cooking_date: data.cookingDate,
                    delivery_date: data.deliveryDate,
                    created_by: data.createdBy,
                    status: data.status,
                    category_id: data.categoryId || null,
                    donation_count: 0,
                    received_amount: BigInt(0),
                    is_active: true,
                },
                include: this.CAMPAIGN_JOIN_FIELDS,
            })

            return this.mapToGraphQLModel(campaign)
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

    async findById(id: string) {
        try {
            const campaign = await this.prisma.campaign.findUnique({
                where: {
                    id,
                    is_active: true,
                },
                include: this.CAMPAIGN_JOIN_FIELDS,
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

    async findMany(options: FindManyOptions) {
        const {
            filter,
            search,
            sortBy = CampaignSortOrder.ACTIVE_FIRST,
            limit = 10,
            offset = 0,
        } = options

        try {
            const whereClause: any = {
                AND: [{ is_active: true }],
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

            if (filter?.categoryId) {
                whereClause.AND.push({
                    category_id: filter.categoryId,
                })
            }

            if (search) {
                const sanitizedSearch = sanitizeSearchTerm(search)
                if (sanitizedSearch) {
                    whereClause.AND.push({
                        OR: [
                            {
                                title: {
                                    contains: sanitizedSearch,
                                    mode: "insensitive",
                                },
                            },
                            {
                                description: {
                                    contains: sanitizedSearch,
                                    mode: "insensitive",
                                },
                            },
                            {
                                location: {
                                    contains: sanitizedSearch,
                                    mode: "insensitive",
                                },
                            },
                            {
                                category: {
                                    title: {
                                        contains: sanitizedSearch,
                                        mode: "insensitive",
                                    },
                                },
                            },
                        ],
                    })
                }
            }

            const campaigns = await this.prisma.campaign.findMany({
                where: whereClause,
                include: this.CAMPAIGN_JOIN_FIELDS,
                orderBy: this.buildOrderByClause(sortBy),
                take: Math.min(limit, 100),
                skip: offset,
            })

            return campaigns.map((campaign) => this.mapToGraphQLModel(campaign))
        } catch (error) {
            this.logger.error("Failed to find campaigns:", error)
            this.sentryService.captureError(error as Error, {
                operation: "findManyCampaigns",
                filterData: filter,
                searchTerm: search,
                sortOrder: sortBy,
                limitValue: limit,
                offsetValue: offset,
            })
            throw error
        }
    }

    async update(id: string, data: UpdateCampaignData) {
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
            if (data.ingredientBudgetPercentage !== undefined)
                updateData.ingredient_budget_percentage =
                    data.ingredientBudgetPercentage
            if (data.cookingBudgetPercentage !== undefined)
                updateData.cooking_budget_percentage =
                    data.cookingBudgetPercentage
            if (data.deliveryBudgetPercentage !== undefined)
                updateData.delivery_budget_percentage =
                    data.deliveryBudgetPercentage
            if (data.fundraisingStartDate !== undefined)
                updateData.fundraising_start_date = data.fundraisingStartDate
            if (data.fundraisingEndDate !== undefined)
                updateData.fundraising_end_date = data.fundraisingEndDate
            if (data.ingredientPurchaseDate !== undefined)
                updateData.ingredient_purchase_date =
                    data.ingredientPurchaseDate
            if (data.cookingDate !== undefined)
                updateData.cooking_date = data.cookingDate
            if (data.deliveryDate !== undefined)
                updateData.delivery_date = data.deliveryDate
            if (data.status !== undefined) updateData.status = data.status
            if (data.approvedAt !== undefined)
                updateData.approved_at = data.approvedAt
            if (data.completedAt !== undefined)
                updateData.completed_at = data.completedAt
            if (data.fundsDisbursedAt !== undefined)
                updateData.funds_disbursed_at = data.fundsDisbursedAt
            if (data.ingredientFundsAmount !== undefined)
                updateData.ingredient_funds_amount = data.ingredientFundsAmount
            if (data.cookingFundsAmount !== undefined)
                updateData.cooking_funds_amount = data.cookingFundsAmount
            if (data.deliveryFundsAmount !== undefined)
                updateData.delivery_funds_amount = data.deliveryFundsAmount
            if (data.categoryId !== undefined)
                updateData.category_id = data.categoryId

            return await this.prisma.$transaction(async (tx) => {
                const campaign = await tx.campaign.update({
                    where: {
                        id,
                        is_active: true,
                    },
                    data: updateData,
                    include: this.CAMPAIGN_JOIN_FIELDS,
                })
                return this.mapToGraphQLModel(campaign)
            })
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
                AND: [{ is_active: true }],
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
                where: whereClause,
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

    async delete(id: string) {
        try {
            const result = await this.prisma.campaign.update({
                where: {
                    id,
                    is_active: true,
                },
                data: {
                    is_active: false,
                    updated_at: new Date(),
                },
                select: { id: true },
            })

            return !!result
        } catch (error) {
            this.logger.error(`Failed to soft delete campaign ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "softDeleteCampaign",
                campaignId: id,
            })
            throw error
        }
    }

    async reactivate(id: string) {
        try {
            const campaign = await this.prisma.campaign.update({
                where: {
                    id,
                    is_active: false,
                },
                data: {
                    is_active: true,
                    updated_at: new Date(),
                },
                include: this.CAMPAIGN_JOIN_FIELDS,
            })

            return this.mapToGraphQLModel(campaign)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "reactivateCampaign",
                campaignId: id,
            })
            throw error
        }
    }

    private buildOrderByClause(sortBy: CampaignSortOrder): any {
        switch (sortBy) {
        case CampaignSortOrder.ACTIVE_FIRST:
            return [{ status: "asc" }, { created_at: "desc" }]
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

    private mapToGraphQLModel(dbCampaign: any) {
        const bigIntFields = {
            targetAmount: dbCampaign.target_amount?.toString() ?? "0",
            receivedAmount: dbCampaign.received_amount?.toString() ?? "0",
        }

        const budgetPercentages = {
            ingredientBudgetPercentage:
                dbCampaign.ingredient_budget_percentage?.toString() ?? "0",
            cookingBudgetPercentage:
                dbCampaign.cooking_budget_percentage?.toString() ?? "0",
            deliveryBudgetPercentage:
                dbCampaign.delivery_budget_percentage?.toString() ?? "0",
        }

        const disbursementFields = {
            ingredientFundsAmount:
                dbCampaign.ingredient_funds_amount?.toString() ?? undefined,
            cookingFundsAmount:
                dbCampaign.cooking_funds_amount?.toString() ?? undefined,
            deliveryFundsAmount:
                dbCampaign.delivery_funds_amount?.toString() ?? undefined,
            fundsDisbursedAt: dbCampaign.funds_disbursed_at || undefined,
        }

        const category = dbCampaign.category
            ? {
                id: dbCampaign.category.id,
                title: dbCampaign.category.title,
                description: dbCampaign.category.description,
                isActive: dbCampaign.category.is_active,
                created_at: dbCampaign.category.created_at,
                updated_at: dbCampaign.category.updated_at,
                campaigns: undefined,
            }
            : undefined

        const creator: User | undefined = dbCampaign.created_by
            ? {
                __typename: "User",
                id: dbCampaign.created_by,
            }
            : undefined

        return {
            id: dbCampaign.id,
            title: dbCampaign.title,
            description: dbCampaign.description,
            coverImage: dbCampaign.cover_image,
            coverImageFileKey: dbCampaign.cover_image_file_key || undefined,
            location: dbCampaign.location,
            donationCount: dbCampaign.donation_count,
            ...bigIntFields,
            ...budgetPercentages,
            status: dbCampaign.status as CampaignStatus,
            fundraisingStartDate: dbCampaign.fundraising_start_date,
            fundraisingEndDate: dbCampaign.fundraising_end_date,
            ingredientPurchaseDate: dbCampaign.ingredient_purchase_date,
            cookingDate: dbCampaign.cooking_date,
            deliveryDate: dbCampaign.delivery_date,
            ...disbursementFields,
            isActive: dbCampaign.is_active,
            createdBy: dbCampaign.created_by,
            categoryId: dbCampaign.category_id || undefined,
            approvedAt: dbCampaign.approved_at || undefined,
            completedAt: dbCampaign.completed_at || undefined,
            created_at: dbCampaign.created_at,
            updated_at: dbCampaign.updated_at,
            category: category,
            creator: creator,
            donations: undefined,
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
