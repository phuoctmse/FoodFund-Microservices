import { SentryService } from "@libs/observability/sentry.service"
import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { UpdateCampaignCategoryInput } from "./dtos/request/campaign-category.input"
import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { sanitizeSearchTerm } from "@libs/common/utils/sanitize-search-term.util"

export interface FindManyCategoriesOptions {
    search?: string
    limit?: number
    offset?: number
    includeInactive?: boolean
}

interface CreateCategoryData {
    title: string
    description: string
}

interface UpdateCategoryData extends Partial<UpdateCampaignCategoryInput> {}

@Injectable()
export class CampaignCategoryRepository {
    private readonly logger = new Logger(CampaignCategoryRepository.name)

    private readonly CATEGORY_SELECT_FIELDS = {
        id: true,
        title: true,
        description: true,
        is_active: true,
        created_at: true,
        updated_at: true,
    } as const

    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Create a new campaign category
     */
    async create(data: CreateCategoryData): Promise<CampaignCategory> {
        try {
            const category = await this.prisma.campaign_Category.create({
                data: {
                    title: data.title,
                    description: data.description,
                    is_active: true,
                },
                select: this.CATEGORY_SELECT_FIELDS,
            })

            this.logger.log(
                `Created new category: ${category.title} (${category.id})`,
            )
            return this.mapToGraphQLModel(category)
        } catch (error) {
            this.logger.error("Failed to create category:", error)
            this.sentryService.captureError(error as Error, {
                operation: "createCategory",
                data: {
                    title: data.title,
                    hasDescription: !!data.description,
                },
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Find category by ID
     */
    async findById(
        id: string,
        includeInactive: boolean = false,
    ): Promise<CampaignCategory | null> {
        try {
            const whereClause: any = { id }
            if (!includeInactive) {
                whereClause.is_active = true
            }

            const category = await this.prisma.campaign_Category.findUnique({
                where: whereClause,
                select: this.CATEGORY_SELECT_FIELDS,
            })

            return category ? this.mapToGraphQLModel(category) : null
        } catch (error) {
            this.logger.error(`Failed to find category by ID ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "findCategoryById",
                categoryId: id,
                includeInactive,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Find multiple categories with filtering and pagination
     */
    async findMany(
        options: FindManyCategoriesOptions,
    ): Promise<CampaignCategory[]> {
        const {
            search,
            limit = 50,
            offset = 0,
            includeInactive = false,
        } = options

        try {
            const whereClause: any = {}

            if (!includeInactive) {
                whereClause.is_active = true
            }

            if (search) {
                const sanitizedSearch = sanitizeSearchTerm(search)
                if (sanitizedSearch) {
                    whereClause.OR = [
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
                    ]
                }
            }

            const categories = await this.prisma.campaign_Category.findMany({
                where: whereClause,
                select: this.CATEGORY_SELECT_FIELDS,
                orderBy: [{ is_active: "desc" }, { title: "asc" }],
                take: Math.min(limit, 100),
                skip: Math.max(offset, 0),
            })

            return categories.map((category) =>
                this.mapToGraphQLModel(category),
            )
        } catch (error) {
            this.logger.error("Failed to find categories:", error)
            this.sentryService.captureError(error as Error, {
                operation: "findManyCategories",
                options,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Update category
     */
    async update(
        id: string,
        data: UpdateCategoryData,
    ): Promise<CampaignCategory> {
        try {
            const existingCategory = await this.findById(id)
            if (!existingCategory) {
                throw new Error(`Category with ID ${id} not found or inactive`)
            }

            const updateData: any = {}
            if (data.title !== undefined) updateData.title = data.title
            if (data.description !== undefined)
                updateData.description = data.description

            const category = await this.prisma.campaign_Category.update({
                where: {
                    id,
                    is_active: true,
                },
                data: updateData,
                select: this.CATEGORY_SELECT_FIELDS,
            })

            this.logger.log(`Updated category: ${category.title} (${id})`)
            return this.mapToGraphQLModel(category)
        } catch (error) {
            this.logger.error(`Failed to update category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "updateCategory",
                categoryId: id,
                updateFields: Object.keys(data),
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Delete category
     */
    async delete(id: string): Promise<boolean> {
        try {
            const campaignCount = await this.prisma.campaign.count({
                where: {
                    category_id: id,
                    is_active: true,
                },
            })

            if (campaignCount > 0) {
                throw new Error(
                    `Cannot delete category: ${campaignCount} active campaigns are using this category`,
                )
            }

            const result = await this.prisma.campaign_Category.update({
                where: {
                    id,
                    is_active: true,
                },
                data: {
                    is_active: false,
                    updated_at: new Date(),
                },
                select: { id: true, title: true },
            })

            this.sentryService.addBreadcrumb(
                "Category soft deleted",
                "category",
                { categoryId: id, title: result.title },
            )

            return !!result
        } catch (error) {
            this.logger.error(`Failed to soft delete category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "softDeleteCategory",
                categoryId: id,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Reactivate a soft-deleted category
     */
    async reactivate(id: string): Promise<CampaignCategory | null> {
        try {
            const category = await this.prisma.campaign_Category.update({
                where: {
                    id,
                    is_active: false,
                },
                data: {
                    is_active: true,
                    updated_at: new Date(),
                },
                select: this.CATEGORY_SELECT_FIELDS,
            })

            this.sentryService.addBreadcrumb(
                "Category reactivated",
                "category",
                { categoryId: id, title: category.title },
            )

            return this.mapToGraphQLModel(category)
        } catch (error) {
            this.logger.error(`Failed to reactivate category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "reactivateCategory",
                categoryId: id,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Count categories with optional filtering
     */
    async count(
        search?: string,
        includeInactive: boolean = false,
    ): Promise<number> {
        try {
            const whereClause: any = {}

            if (!includeInactive) {
                whereClause.is_active = true
            }

            if (search) {
                const sanitizedSearch = sanitizeSearchTerm(search)
                if (sanitizedSearch) {
                    whereClause.OR = [
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
                    ]
                }
            }

            const count = await this.prisma.campaign_Category.count({
                where: whereClause,
            })

            return count
        } catch (error) {
            this.logger.error("Failed to count categories:", error)
            this.sentryService.captureError(error as Error, {
                operation: "countCategories",
                search,
                includeInactive,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Get categories with campaign counts
     */
    async findWithCampaignCounts(): Promise<
        Array<CampaignCategory & { campaignCount: number }>
        > {
        try {
            const categories = await this.prisma.campaign_Category.findMany({
                where: { is_active: true },
                select: {
                    ...this.CATEGORY_SELECT_FIELDS,
                    _count: {
                        select: {
                            campaigns: {
                                where: { is_active: true },
                            },
                        },
                    },
                },
                orderBy: { title: "asc" },
            })

            return categories.map((category) => ({
                ...this.mapToGraphQLModel(category),
                campaignCount: category._count.campaigns,
            }))
        } catch (error) {
            this.logger.error(
                "Failed to find categories with campaign counts:",
                error,
            )
            this.sentryService.captureError(error as Error, {
                operation: "findCategoriesWithCampaignCounts",
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Check if category exists and is active
     */
    async isCategoryActive(categoryId: string): Promise<boolean> {
        try {
            const count = await this.prisma.campaign_Category.count({
                where: {
                    id: categoryId,
                    is_active: true,
                },
            })

            const isActive = count > 0

            return isActive
        } catch (error) {
            this.logger.error(
                `Failed to check category status ${categoryId}:`,
                error,
            )
            this.sentryService.captureError(error as Error, {
                operation: "isCategoryActive",
                categoryId,
                service: "campaign-category-repository",
            })
            throw error
        }
    }

    /**
     * Map database model to GraphQL model
     */
    private mapToGraphQLModel(dbCategory: any): CampaignCategory {
        return {
            id: dbCategory.id,
            title: dbCategory.title,
            description: dbCategory.description,
            isActive: dbCategory.is_active,
            createdAt: dbCategory.created_at,
            updatedAt: dbCategory.updated_at,
            campaigns: undefined,
        }
    }

    /**
     * Health check for database connection
     */
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        try {
            await this.prisma.$queryRaw`SELECT 1 as health_check`
            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "categoryRepositoryHealthCheck",
                service: "campaign-category-repository",
                database: "postgresql",
            })

            throw new Error(
                `Category repository health check failed: ${error.message}`,
            )
        }
    }
}
