import { SentryService } from "@libs/observability/sentry.service"
import { Injectable } from "@nestjs/common"
import { CampaignStatus } from "../enum"
import { PrismaClient } from "../../generated/campaign-client"
import { sanitizeSearchTerm, User } from "../../shared"
import { Campaign } from "../models"
import { CampaignFilterInput, CampaignSortOrder } from "../dtos"

export interface FindManyOptions {
    filter?: CampaignFilterInput
    search?: string
    sortBy?: CampaignSortOrder
    limit?: number
    offset?: number
}

export interface CreateCampaignData {
    title: string
    description: string
    coverImage: string
    coverImageFileKey?: string
    targetAmount: bigint
    ingredientBudgetPercentage: number
    cookingBudgetPercentage: number
    deliveryBudgetPercentage: number
    fundraisingStartDate: Date
    fundraisingEndDate: Date
    createdBy: string
    categoryId?: string
    status?: CampaignStatus
    phases?: Array<{
        phaseName: string
        location: string
        ingredientPurchaseDate: Date
        cookingDate: Date
        deliveryDate: Date
    }>
}

export interface UpdateCampaignData {
    title?: string
    description?: string
    coverImage?: string
    coverImageFileKey?: string
    targetAmount?: bigint
    ingredientBudgetPercentage?: number
    cookingBudgetPercentage?: number
    deliveryBudgetPercentage?: number
    fundraisingStartDate?: Date
    fundraisingEndDate?: Date
    categoryId?: string
    status?: CampaignStatus
    changedStatusAt?: Date | null
    completedAt?: Date | null
    extensionCount?: number
    extensionDays?: number
    donationCount?: number
}

@Injectable()
export class CampaignRepository {
    private readonly CAMPAIGN_JOIN_FIELDS = {
        category: {
            where: { is_active: true },
            select: {
                id: true,
                title: true,
                description: true,
                is_active: true,
                created_at: true,
                updated_at: true,
            },
        },
        campaign_phases: {
            where: { is_active: true },
            orderBy: { created_at: "asc" as const },
        },
    } as const

    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(data: CreateCampaignData): Promise<Campaign> {
        try {
            const { phases, ...campaignData } = data

            const result = await this.prisma.$transaction(async (tx) => {
                const campaign = await tx.campaign.create({
                    data: {
                        title: campaignData.title,
                        description: campaignData.description,
                        cover_image: campaignData.coverImage,
                        cover_image_file_key: campaignData.coverImageFileKey,
                        target_amount: campaignData.targetAmount,
                        ingredient_budget_percentage:
                            campaignData.ingredientBudgetPercentage,
                        cooking_budget_percentage:
                            campaignData.cookingBudgetPercentage,
                        delivery_budget_percentage:
                            campaignData.deliveryBudgetPercentage,
                        fundraising_start_date:
                            campaignData.fundraisingStartDate,
                        fundraising_end_date: campaignData.fundraisingEndDate,
                        created_by: campaignData.createdBy,
                        category_id: campaignData.categoryId,
                        status: campaignData.status || CampaignStatus.PENDING,
                        is_active: true,
                    },
                    include: this.CAMPAIGN_JOIN_FIELDS,
                })

                if (phases && phases.length > 0) {
                    await tx.campaign_Phase.createMany({
                        data: phases.map((phase) => ({
                            campaign_id: campaign.id,
                            phase_name: phase.phaseName,
                            location: phase.location,
                            ingredient_purchase_date:
                                phase.ingredientPurchaseDate,
                            cooking_date: phase.cookingDate,
                            delivery_date: phase.deliveryDate,
                            status: "PLANNING" as const,
                            is_active: true,
                        })),
                    })
                }

                return await tx.campaign.findUnique({
                    where: { id: campaign.id },
                    include: this.CAMPAIGN_JOIN_FIELDS,
                })
            })

            return this.mapToGraphQLModel(result!)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createCampaign",
                title: data.title,
                createdBy: data.createdBy,
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
                take: options.limit,
                skip: options.offset,
                orderBy: this.buildOrderByClause(sortBy),
            })

            return campaigns.map((c) => this.mapToGraphQLModel(c))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findManyCampaigns",
            })
            throw error
        }
    }

    async findById(id: string): Promise<Campaign | null> {
        try {
            const campaign = await this.prisma.campaign.findUnique({
                where: { id, is_active: true },
                include: this.CAMPAIGN_JOIN_FIELDS,
            })

            return campaign ? this.mapToGraphQLModel(campaign) : null
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findCampaignById",
                campaignId: id,
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
            if (data.targetAmount !== undefined)
                updateData.target_amount = data.targetAmount
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
            if (data.categoryId !== undefined)
                updateData.category_id = data.categoryId
            if (data.status !== undefined) updateData.status = data.status
            if (data.changedStatusAt !== undefined)
                updateData.changed_status_at = data.changedStatusAt
            if (data.completedAt !== undefined)
                updateData.completed_at = data.completedAt
            if (data.extensionCount !== undefined)
                updateData.extension_count = data.extensionCount
            if (data.extensionDays !== undefined)
                updateData.extension_days = data.extensionDays
            if (data.donationCount !== undefined)
                updateData.donation_count = data.donationCount

            const campaign = await this.prisma.campaign.update({
                where: { id, is_active: true },
                data: updateData,
                include: this.CAMPAIGN_JOIN_FIELDS,
            })

            return this.mapToGraphQLModel(campaign)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaign",
                campaignId: id,
                updateFields: Object.keys(data),
            })
            throw error
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.campaign_Phase.updateMany({
                    where: { campaign_id: id },
                    data: {
                        is_active: false,
                        updated_at: new Date(),
                    },
                })

                await tx.campaign.update({
                    where: { id },
                    data: {
                        is_active: false,
                        updated_at: new Date(),
                    },
                })
            })

            return true
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "deleteCampaign",
                campaignId: id,
            })
            throw error
        }
    }

    async count(filter?: any): Promise<number> {
        try {
            return await this.prisma.campaign.count({
                where: {
                    is_active: true,
                    ...filter,
                },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "countCampaigns",
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
        case CampaignSortOrder.MOST_DONATED:
            return { donation_count: "desc" }
        case CampaignSortOrder.LEAST_DONATED:
            return { donation_count: "asc" }
        default:
            return { created_at: "desc" }
        }
    }

    private mapToGraphQLModel(dbCampaign: any): Campaign {
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

        const phases =
            dbCampaign.campaign_phases?.map((phase: any) => ({
                id: phase.id,
                campaignId: phase.campaign_id,
                phaseName: phase.phase_name,
                location: phase.location,
                ingredientPurchaseDate: phase.ingredient_purchase_date,
                cookingDate: phase.cooking_date,
                deliveryDate: phase.delivery_date,
                status: phase.status,
                created_at: phase.created_at,
                updated_at: phase.updated_at,
            })) || []

        return {
            id: dbCampaign.id,
            title: dbCampaign.title,
            description: dbCampaign.description,
            coverImage: dbCampaign.cover_image,
            coverImageFileKey: dbCampaign.cover_image_file_key || undefined,
            donationCount: dbCampaign.donation_count ?? 0,
            ...bigIntFields,
            ...budgetPercentages,
            status: dbCampaign.status as CampaignStatus,
            fundraisingStartDate: dbCampaign.fundraising_start_date,
            fundraisingEndDate: dbCampaign.fundraising_end_date,
            ...disbursementFields,
            isActive: dbCampaign.is_active,
            createdBy: dbCampaign.created_by,
            categoryId: dbCampaign.category_id || undefined,
            changedStatusAt: dbCampaign.changed_status_at || undefined,
            completedAt: dbCampaign.completed_at || undefined,
            extensionCount: dbCampaign.extension_count ?? 0,
            extensionDays: dbCampaign.extension_days ?? 0,
            created_at: dbCampaign.created_at,
            updated_at: dbCampaign.updated_at,
            category: category,
            creator: creator,
            donations: undefined,
            phases: phases,
        } as Campaign
    }
}
