import { Injectable } from "@nestjs/common"
import { Prisma, PrismaClient } from "../../generated/campaign-client"
import { sanitizeSearchTerm, User } from "../../shared"
import {
    CampaignFilterInput,
    CampaignSortOrder,
} from "../dtos/campaign/request"
import { CampaignStatus } from "../../domain/enums/campaign/campaign.enum"
import { Campaign } from "../../domain/entities/campaign.model"
import {
    generateRandomSuffix,
    generateSlug,
    generateUniqueSlug,
    minBigInt,
} from "../../shared/utils"
import { Organization } from "../../shared/model"

export interface FindManyOptions {
    filter?: CampaignFilterInput
    search?: string
    sortBy?: CampaignSortOrder
    limit?: number
    offset?: number
}

export interface CreateCampaignData {
    title: string
    slug?: string
    description: string
    coverImage: string
    coverImageFileKey?: string
    targetAmount: bigint
    fundraisingStartDate: Date
    fundraisingEndDate: Date
    createdBy: string
    organizationId: string
    categoryId?: string
    status?: CampaignStatus
    phases?: Array<{
        phaseName: string
        location: string
        ingredientPurchaseDate: Date
        cookingDate: Date
        deliveryDate: Date
        ingredientBudgetPercentage: number
        cookingBudgetPercentage: number
        deliveryBudgetPercentage: number
        plannedMeals?: Array<{
            name: string
            quantity: number
        }>
        plannedIngredients?: Array<{
            name: string
            quantity: number
            unit: string
        }>
    }>
}

export interface UpdateCampaignData {
    title?: string
    description?: string
    coverImage?: string
    coverImageFileKey?: string
    targetAmount?: bigint
    fundraisingStartDate?: Date
    fundraisingEndDate?: Date
    categoryId?: string
    status?: CampaignStatus
    changedStatusAt?: Date | null
    completedAt?: Date | null
    extensionCount?: number
    extensionDays?: number
    donationCount?: number
    receivedAmount?: bigint
    reason?: string
}

export interface ExtendCampaignData {
    campaignId: string
    extensionDays: number
    newFundraisingEndDate: Date
}

export interface StatsDateRange {
    dateFrom?: Date
    dateTo?: Date
}

export interface CategoryStatsData {
    categoryId: string
    categoryTitle: string
    campaignCount: number
    totalReceivedAmount: bigint
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
            include: {
                plannedMeals: true,
                plannedIngredients: true,
            },
        },
    } as const

    constructor(private readonly prisma: PrismaClient) { }

    async create(data: CreateCampaignData): Promise<Campaign> {
        const { phases, ...campaignData } = data
        const slug = await this.generateUniqueSlug(campaignData.title)

        const result = await this.prisma.$transaction(async (tx) => {
            const campaign = await tx.campaign.create({
                data: {
                    title: campaignData.title,
                    slug,
                    description: campaignData.description,
                    cover_image: campaignData.coverImage,
                    cover_image_file_key: campaignData.coverImageFileKey,
                    target_amount: campaignData.targetAmount,
                    fundraising_start_date: campaignData.fundraisingStartDate,
                    fundraising_end_date: campaignData.fundraisingEndDate,
                    created_by: campaignData.createdBy,
                    organization_id: campaignData.organizationId,
                    category_id: campaignData.categoryId,
                    status: campaignData.status || CampaignStatus.PENDING,
                    is_active: true,
                },
            })

            if (phases && phases.length > 0) {
                for (const phase of phases) {
                    const createdPhase = await tx.campaign_Phase.create({
                        data: {
                            campaign_id: campaign.id,
                            phase_name: phase.phaseName,
                            location: phase.location,
                            ingredient_purchase_date: phase.ingredientPurchaseDate,
                            cooking_date: phase.cookingDate,
                            delivery_date: phase.deliveryDate,
                            ingredient_budget_percentage: phase.ingredientBudgetPercentage,
                            cooking_budget_percentage: phase.cookingBudgetPercentage,
                            delivery_budget_percentage: phase.deliveryBudgetPercentage,
                            status: "PLANNING" as const,
                            is_active: true,
                        },
                    })

                    if (phase.plannedMeals && phase.plannedMeals.length > 0) {
                        await tx.planned_Meal.createMany({
                            data: phase.plannedMeals.map((meal) => ({
                                campaign_phase_id: createdPhase.id,
                                name: meal.name,
                                quantity: meal.quantity,
                            })),
                        })
                    }

                    if (phase.plannedIngredients && phase.plannedIngredients.length > 0) {
                        await tx.planned_Ingredient.createMany({
                            data: phase.plannedIngredients.map((ingredient) => ({
                                campaign_phase_id: createdPhase.id,
                                name: ingredient.name,
                                quantity: ingredient.quantity,
                                unit: ingredient.unit,
                            })),
                        })
                    }
                }
            }

            return await tx.campaign.findUnique({
                where: { id: campaign.id },
                include: this.CAMPAIGN_JOIN_FIELDS,
            })
        })

        return this.mapToGraphQLModel(result!)
    }

    async findMany(options: FindManyOptions): Promise<Campaign[]> {
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
                            category: {
                                title: {
                                    contains: sanitizedSearch,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            campaign_phases: {
                                some: {
                                    location: {
                                        contains: sanitizedSearch,
                                        mode: "insensitive",
                                    },
                                    is_active: true,
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
    }

    async findAll(): Promise<Campaign[]> {
        const campaigns = await this.prisma.campaign.findMany({
            where: { is_active: true },
            include: this.CAMPAIGN_JOIN_FIELDS,
        })
        return campaigns.map((c) => this.mapToGraphQLModel(c))
    }

    async findRecentlyUpdated(since: Date): Promise<Campaign[]> {
        const campaigns = await this.prisma.campaign.findMany({
            where: {
                is_active: true,
                updated_at: {
                    gte: since,
                },
            },
            include: this.CAMPAIGN_JOIN_FIELDS,
        })
        return campaigns.map((c) => this.mapToGraphQLModel(c))
    }

    async findById(id: string): Promise<Campaign | null> {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id, is_active: true },
            include: this.CAMPAIGN_JOIN_FIELDS,
        })

        return campaign ? this.mapToGraphQLModel(campaign) : null
    }

    async findApprovedCampaignsToActivateForJob(): Promise<
        Pick<Campaign, "id" | "status">[]
        > {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const campaigns = await this.prisma.campaign.findMany({
            where: {
                is_active: true,
                status: CampaignStatus.APPROVED,
                fundraising_start_date: {
                    lte: today,
                },
            },
            select: {
                id: true,
                status: true,
            },
            orderBy: {
                fundraising_start_date: "asc",
            },
        })

        return campaigns.map((c) => ({
            id: c.id,
            status: c.status as CampaignStatus,
        }))
    }

    async findActiveCampaignsToCompleteForJob(): Promise<
        Pick<
            Campaign,
            | "id"
            | "status"
            | "receivedAmount"
            | "targetAmount"
            | "createdBy"
            | "title"
        >[]
        > {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        const campaigns = await this.prisma.campaign.findMany({
            where: {
                is_active: true,
                status: CampaignStatus.ACTIVE,
                OR: [
                    { fundraising_end_date: { lte: today } },
                    {
                        received_amount: {
                            gte: this.prisma.campaign.fields.target_amount,
                        },
                    },
                ],
            },
            select: {
                id: true,
                status: true,
                received_amount: true,
                target_amount: true,
                created_by: true,
                title: true,
            },
            orderBy: { fundraising_end_date: "asc" },
        })

        return campaigns.map((c) => ({
            id: c.id,
            status: c.status as CampaignStatus,
            receivedAmount: c.received_amount?.toString() ?? "0",
            targetAmount: c.target_amount?.toString() ?? "0",
            createdBy: c.created_by,
            title: c.title,
        }))
    }

    async findExpiredCampaignsForJob(): Promise<
        Pick<Campaign, "id" | "status">[]
        > {
        const today = new Date()
        today.setHours(23, 59, 59, 999)

        const campaigns = await this.prisma.campaign.findMany({
            where: {
                is_active: true,
                status: {
                    in: [CampaignStatus.PENDING, CampaignStatus.APPROVED],
                },
                fundraising_end_date: {
                    lte: today,
                },
            },
            select: {
                id: true,
                status: true,
            },
            orderBy: {
                fundraising_end_date: "asc",
            },
        })

        return campaigns.map((c) => ({
            id: c.id,
            status: c.status as CampaignStatus,
        }))
    }

    async findActiveCampaignByCreator(creatorId: string): Promise<{
        id: string
        title: string
        status: CampaignStatus
    } | null> {
        const activeStatuses = [
            CampaignStatus.PENDING,
            CampaignStatus.APPROVED,
            CampaignStatus.ACTIVE,
            CampaignStatus.PROCESSING,
        ]

        const campaign = await this.prisma.campaign.findFirst({
            where: {
                created_by: creatorId,
                is_active: true,
                status: {
                    in: activeStatuses,
                },
            },
            select: {
                id: true,
                title: true,
                status: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })

        return campaign
            ? {
                id: campaign.id,
                title: campaign.title,
                status: campaign.status as CampaignStatus,
            }
            : null
    }

    async findBySlug(slug: string): Promise<Campaign | null> {
        const campaign = await this.prisma.campaign.findUnique({
            where: { slug, is_active: true },
            include: this.CAMPAIGN_JOIN_FIELDS,
        })

        return campaign ? this.mapToGraphQLModel(campaign) : null
    }

    async slugExists(slug: string): Promise<boolean> {
        const count = await this.prisma.campaign.count({
            where: { slug },
        })
        return count > 0
    }

    async generateUniqueSlug(title: string): Promise<string> {
        const baseSlug = generateSlug(title)

        if (!baseSlug) {
            return `campaign-${generateRandomSuffix(8)}`
        }

        const exists = await this.slugExists(baseSlug)
        if (!exists) {
            return baseSlug
        }

        for (let i = 0; i < 5; i++) {
            const uniqueSlug = generateUniqueSlug(
                baseSlug,
                generateRandomSuffix(6),
            )
            const suffixExists = await this.slugExists(uniqueSlug)
            if (!suffixExists) {
                return uniqueSlug
            }
        }

        return generateUniqueSlug(baseSlug, Date.now().toString(36))
    }

    async updateSlug(id: string, newTitle: string): Promise<string> {
        const newSlug = await this.generateUniqueSlug(newTitle)

        await this.prisma.campaign.update({
            where: { id, is_active: true },
            data: { slug: newSlug },
        })

        return newSlug
    }

    async getTotalCampaigns(categoryId?: string): Promise<number> {
        return await this.prisma.campaign.count({
            where: {
                is_active: true,
                ...(categoryId && { category_id: categoryId }),
            },
        })
    }

    async getCountByStatus(
        status: CampaignStatus,
        categoryId?: string,
    ): Promise<number> {
        return await this.prisma.campaign.count({
            where: {
                is_active: true,
                status,
                ...(categoryId && { category_id: categoryId }),
            },
        })
    }

    async getFinancialAggregates(categoryId?: string): Promise<{
        totalTargetAmount: bigint
        totalReceivedAmount: bigint
        totalDonations: number
    }> {
        const result = await this.prisma.campaign.aggregate({
            where: {
                is_active: true,
                ...(categoryId && { category_id: categoryId }),
            },
            _sum: {
                target_amount: true,
                received_amount: true,
                donation_count: true,
            },
        })

        return {
            totalTargetAmount: result._sum.target_amount || BigInt(0),
            totalReceivedAmount: result._sum.received_amount || BigInt(0),
            totalDonations: result._sum.donation_count || 0,
        }
    }

    async getCategoryStats(): Promise<CategoryStatsData[]> {
        const categories = await this.prisma.campaign_Category.findMany({
            where: { is_active: true },
            select: {
                id: true,
                title: true,
            },
        })

        const categoryStats = await Promise.all(
            categories.map(async (category) => {
                const result = await this.prisma.campaign.aggregate({
                    where: {
                        is_active: true,
                        category_id: category.id,
                    },
                    _sum: {
                        received_amount: true,
                    },
                    _count: {
                        id: true,
                    },
                })

                return {
                    categoryId: category.id,
                    categoryTitle: category.title,
                    campaignCount: result._count.id,
                    totalReceivedAmount:
                        result._sum.received_amount || BigInt(0),
                }
            }),
        )

        return categoryStats.filter((stat) => stat.campaignCount > 0)
    }

    async getMostFundedCampaign(): Promise<{
        id: string
        title: string
    } | null> {
        const campaign = await this.prisma.campaign.findFirst({
            where: {
                is_active: true,
            },
            orderBy: {
                received_amount: "desc",
            },
            select: {
                id: true,
                title: true,
            },
        })

        return campaign || null
    }

    async getAverageCampaignDuration(): Promise<number | null> {
        const campaigns = await this.prisma.campaign.findMany({
            where: {
                is_active: true,
                status: {
                    in: [CampaignStatus.COMPLETED, CampaignStatus.ACTIVE],
                },
            },
            select: {
                fundraising_start_date: true,
                fundraising_end_date: true,
            },
        })

        if (campaigns.length === 0) return null

        const totalDays = campaigns.reduce((sum, campaign) => {
            const startDate = new Date(campaign.fundraising_start_date)
            const endDate = new Date(campaign.fundraising_end_date)
            const diffMs = endDate.getTime() - startDate.getTime()
            const diffDays = diffMs / (1000 * 60 * 60 * 24)
            return sum + diffDays
        }, 0)

        return Math.round(totalDays / campaigns.length)
    }

    async getTimeRangeStats(
        dateFrom: Date,
        dateTo: Date,
    ): Promise<{
        campaignsCreated: number
        campaignsCompleted: number
        totalRaised: bigint
        donationsMade: number
    }> {
        const campaignsCreated = await this.prisma.campaign.count({
            where: {
                is_active: true,
                created_at: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
        })

        const campaignsCompleted = await this.prisma.campaign.count({
            where: {
                is_active: true,
                status: CampaignStatus.COMPLETED,
                completed_at: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
        })

        const financialData = await this.prisma.campaign.aggregate({
            where: {
                is_active: true,
                created_at: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
            _sum: {
                received_amount: true,
                donation_count: true,
            },
        })

        return {
            campaignsCreated,
            campaignsCompleted,
            totalRaised: financialData._sum.received_amount || BigInt(0),
            donationsMade: financialData._sum.donation_count || 0,
        }
    }

    async getCampaignsByDateRange(
        dateFrom: Date,
        dateTo: Date,
        statuses?: CampaignStatus[],
    ): Promise<number> {
        return await this.prisma.campaign.count({
            where: {
                is_active: true,
                created_at: {
                    gte: dateFrom,
                    lte: dateTo,
                },
                ...(statuses && { status: { in: statuses } }),
            },
        })
    }

    async update(id: string, data: UpdateCampaignData): Promise<Campaign> {
        const updateData = this.buildUpdateData(data)

        const campaign = await this.prisma.campaign.update({
            where: { id, is_active: true },
            data: updateData,
            include: this.CAMPAIGN_JOIN_FIELDS,
        })

        return this.mapToGraphQLModel(campaign)
    }

    async extendCampaignWithPhases(
        data: ExtendCampaignData,
    ): Promise<Campaign> {
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.campaign.update({
                where: {
                    id: data.campaignId,
                    is_active: true,
                },
                data: {
                    fundraising_end_date: data.newFundraisingEndDate,
                    extension_count: 1,
                    extension_days: data.extensionDays,
                    updated_at: new Date(),
                },
            })

            await tx.$executeRaw(
                Prisma.sql`
                    UPDATE campaign_phases
                    SET
                        ingredient_purchase_date = ingredient_purchase_date + (${data.extensionDays} || ' days')::INTERVAL,
                        cooking_date = cooking_date + (${data.extensionDays} || ' days')::INTERVAL,
                        delivery_date = delivery_date + (${data.extensionDays} || ' days')::INTERVAL,
                        updated_at = NOW()
                    WHERE
                        campaign_id = ${data.campaignId}
                        AND is_active = true
                `,
            )

            const campaignWithPhases = await tx.campaign.findUnique({
                where: { id: data.campaignId },
                include: this.CAMPAIGN_JOIN_FIELDS,
            })

            return campaignWithPhases
        })

        if (!result) {
            throw new Error(
                `Failed to extend campaign ${data.campaignId} with phases`,
            )
        }

        return this.mapToGraphQLModel(result)
    }

    async areAllPhasesFinished(campaignId: string): Promise<{
        allFinished: boolean
        pendingPhases: Array<{ id: string; phaseName: string; status: string }>
    }> {
        const phases = await this.prisma.campaign_Phase.findMany({
            where: {
                campaign_id: campaignId,
                is_active: true,
            },
            select: {
                id: true,
                phase_name: true,
                status: true,
            },
        })

        const finishedStatuses = new Set(["COMPLETED", "FAILED"])

        const pendingPhases = phases.filter(
            (phase) => !finishedStatuses.has(phase.status),
        )

        return {
            allFinished: pendingPhases.length === 0,
            pendingPhases: pendingPhases.map((p) => ({
                id: p.id,
                phaseName: p.phase_name,
                status: p.status,
            })),
        }
    }

    async markAsCompleted(campaignId: string): Promise<Campaign> {
        const campaign = await this.prisma.campaign.update({
            where: { id: campaignId, is_active: true },
            data: {
                status: CampaignStatus.COMPLETED,
                completed_at: new Date(),
                changed_status_at: new Date(),
            },
            include: this.CAMPAIGN_JOIN_FIELDS,
        })

        return this.mapToGraphQLModel(campaign)
    }

    async delete(id: string): Promise<boolean> {
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
    }

    async count(filter?: any): Promise<number> {
        return await this.prisma.campaign.count({
            where: {
                is_active: true,
                ...filter,
            },
        })
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

        const disbursementFields = {
            ingredientFundsAmount:
                dbCampaign.ingredient_funds_amount?.toString() ?? undefined,
            cookingFundsAmount:
                dbCampaign.cooking_funds_amount?.toString() ?? undefined,
            deliveryFundsAmount:
                dbCampaign.delivery_funds_amount?.toString() ?? undefined,
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

        const organization: Organization | undefined =
            dbCampaign.organization_id
                ? {
                    __typename: "Organization",
                    id: dbCampaign.organization_id,
                }
                : undefined

        const receivedAmount = BigInt(dbCampaign.received_amount || 0)
        const targetAmount = BigInt(dbCampaign.target_amount || 0)
        const fundableAmount = minBigInt(receivedAmount, targetAmount)

        const phases =
            dbCampaign.campaign_phases?.map((phase: any) => {
                const ingredientPct =
                    Number.parseFloat(
                        phase.ingredient_budget_percentage?.toString() || "0",
                    ) / 100
                const cookingPct =
                    Number.parseFloat(
                        phase.cooking_budget_percentage?.toString() || "0",
                    ) / 100
                const deliveryPct =
                    Number.parseFloat(
                        phase.delivery_budget_percentage?.toString() || "0",
                    ) / 100

                const ingredientFunds =
                    fundableAmount > 0n
                        ? (fundableAmount *
                            BigInt(Math.floor(ingredientPct * 10000))) /
                        10000n
                        : 0n
                const cookingFunds =
                    fundableAmount > 0n
                        ? (fundableAmount *
                            BigInt(Math.floor(cookingPct * 10000))) /
                        10000n
                        : 0n
                const deliveryFunds =
                    fundableAmount > 0n
                        ? (fundableAmount *
                            BigInt(Math.floor(deliveryPct * 10000))) /
                        10000n
                        : 0n

                const plannedMeals = phase.plannedMeals?.map((meal: any) => ({
                    id: meal.id,
                    campaignPhaseId: meal.campaign_phase_id,
                    name: meal.name,
                    quantity: meal.quantity,
                    createdAt: meal.created_at,
                    updatedAt: meal.updated_at,
                })) || []

                const plannedIngredients = phase.plannedIngredients?.map((ingredient: any) => ({
                    id: ingredient.id,
                    campaignPhaseId: ingredient.campaign_phase_id,
                    name: ingredient.name,
                    quantity: ingredient.quantity.toString(),
                    unit: ingredient.unit,
                    createdAt: ingredient.created_at,
                    updatedAt: ingredient.updated_at,
                })) || []

                return {
                    id: phase.id,
                    campaignId: phase.campaign_id,
                    phaseName: phase.phase_name,
                    location: phase.location,
                    ingredientPurchaseDate: phase.ingredient_purchase_date,
                    cookingDate: phase.cooking_date,
                    deliveryDate: phase.delivery_date,
                    ingredientBudgetPercentage:
                        phase.ingredient_budget_percentage?.toString() ?? "0",
                    cookingBudgetPercentage:
                        phase.cooking_budget_percentage?.toString() ?? "0",
                    deliveryBudgetPercentage:
                        phase.delivery_budget_percentage?.toString() ?? "0",
                    ingredientFundsAmount:
                        ingredientFunds > 0n
                            ? ingredientFunds.toString()
                            : undefined,
                    cookingFundsAmount:
                        cookingFunds > 0n ? cookingFunds.toString() : undefined,
                    deliveryFundsAmount:
                        deliveryFunds > 0n
                            ? deliveryFunds.toString()
                            : undefined,
                    status: phase.status,
                    plannedMeals,
                    plannedIngredients,
                    created_at: phase.created_at,
                    updated_at: phase.updated_at,
                }
            }) || []

        const computedFields = this.calculateComputedFields(dbCampaign, phases)

        return {
            id: dbCampaign.id,
            title: dbCampaign.title,
            slug: dbCampaign.slug,
            description: dbCampaign.description,
            coverImage: dbCampaign.cover_image,
            coverImageFileKey: dbCampaign.cover_image_file_key || undefined,
            donationCount: dbCampaign.donation_count ?? 0,
            ...bigIntFields,
            status: dbCampaign.status as CampaignStatus,
            fundraisingStartDate: dbCampaign.fundraising_start_date,
            fundraisingEndDate: dbCampaign.fundraising_end_date,
            ...disbursementFields,
            isActive: dbCampaign.is_active,
            createdBy: dbCampaign.created_by,
            organizationId: dbCampaign.organization_id || undefined,
            categoryId: dbCampaign.category_id || undefined,
            changedStatusAt: dbCampaign.changed_status_at || undefined,
            reason: dbCampaign.reason || undefined,
            completedAt: dbCampaign.completed_at || undefined,
            extensionCount: dbCampaign.extension_count ?? 0,
            extensionDays: dbCampaign.extension_days ?? 0,
            created_at: dbCampaign.created_at,
            updated_at: dbCampaign.updated_at,
            category: category,
            creator: creator,
            donations: undefined,
            phases: phases,
            organization: organization,
            ...computedFields,
        } as Campaign
    }

    private calculateComputedFields(
        dbCampaign: any,
        phases: any[],
    ): {
        fundingProgress: number
        daysRemaining: number
        daysActive: number
        totalPhases: number
    } {
        const targetAmount = BigInt(dbCampaign.target_amount || 0)
        const receivedAmount = BigInt(dbCampaign.received_amount || 0)

        let fundingProgress = 0
        if (targetAmount > 0n) {
            fundingProgress =
                (Number(receivedAmount) / Number(targetAmount)) * 100
        }

        const now = new Date()
        const endDate = new Date(dbCampaign.fundraising_end_date)
        const startDate = new Date(dbCampaign.fundraising_start_date)

        const todayMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        )
        const endMidnight = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
        )

        const msPerDay = 1000 * 60 * 60 * 24

        let daysRemaining = Math.ceil(
            (endMidnight.getTime() - todayMidnight.getTime()) / msPerDay,
        )

        if (daysRemaining < 0) {
            daysRemaining = 0
        }

        const startMidnight = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
        )

        let daysActive = 0
        if (todayMidnight >= startMidnight) {
            daysActive =
                Math.floor(
                    (todayMidnight.getTime() - startMidnight.getTime()) /
                    msPerDay,
                ) + 1
        }

        const totalPhases = phases.length

        return {
            fundingProgress: Math.round(fundingProgress * 100) / 100,
            daysRemaining,
            daysActive,
            totalPhases,
        }
    }

    private buildUpdateData(data: UpdateCampaignData): Record<string, any> {
        const fieldMappings: Array<{
            source: keyof UpdateCampaignData
            target: string
        }> = [
            { source: "title", target: "title" },
            { source: "description", target: "description" },
            { source: "coverImage", target: "cover_image" },
            { source: "coverImageFileKey", target: "cover_image_file_key" },
            { source: "targetAmount", target: "target_amount" },
            { source: "fundraisingStartDate", target: "fundraising_start_date" },
            { source: "fundraisingEndDate", target: "fundraising_end_date" },
            { source: "categoryId", target: "category_id" },
            { source: "status", target: "status" },
            { source: "changedStatusAt", target: "changed_status_at" },
            { source: "completedAt", target: "completed_at" },
            { source: "extensionCount", target: "extension_count" },
            { source: "extensionDays", target: "extension_days" },
            { source: "donationCount", target: "donation_count" },
            { source: "receivedAmount", target: "received_amount" },
            { source: "reason", target: "reason" },
        ]

        const updateData: Record<string, any> = {}

        for (const mapping of fieldMappings) {
            const value = data[mapping.source]
            if (value !== undefined) {
                updateData[mapping.target] = value
            }
        }

        return updateData
    }
}
