import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import {
    CampaignCategoryRepository,
    FindManyCategoriesOptions,
} from "./campaign-category.repository"
import { SentryService } from "@libs/observability/sentry.service"
import {
    CreateCampaignCategoryInput,
    UpdateCampaignCategoryInput,
} from "./dtos/request/campaign-category.input"
import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"

@Injectable()
export class CampaignCategoryService {
    private readonly logger = new Logger(CampaignCategoryService.name)

    constructor(
        private readonly categoryRepository: CampaignCategoryRepository,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Create a new campaign category
     */
    async createCategory(
        input: CreateCampaignCategoryInput,
    ): Promise<CampaignCategory> {
        try {
            this.validateCategoryInput(input.title, input.description)

            const existingCategories = await this.categoryRepository.findMany({
                search: input.title,
                limit: 10,
            })

            const isDuplicate = existingCategories.some(
                (category) =>
                    category.title.toLowerCase() === input.title.toLowerCase(),
            )

            if (isDuplicate) {
                throw new BadRequestException(
                    `Category with title "${input.title}" already exists`,
                )
            }

            const category = await this.categoryRepository.create({
                title: input.title.trim(),
                description: input.description.trim(),
            })

            this.sentryService.addBreadcrumb("Category created", "category", {
                categoryId: category.id,
                title: category.title,
            })

            this.logger.log(
                `Created category: ${category.title} (${category.id})`,
            )
            return category
        } catch (error) {
            this.logger.error("Failed to create category:", error)
            this.sentryService.captureError(error as Error, {
                operation: "createCategory",
                input: {
                    title: input.title,
                    hasDescription: !!input.description,
                },
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Get all active categories for selection
     * Optimized for frontend dropdowns and forms
     */
    async getCategories(): Promise<CampaignCategory[]> {
        try {
            return await this.categoryRepository.findMany({
                limit: 100,
                includeInactive: false,
            })
        } catch (error) {
            this.logger.error("Failed to get categories:", error)
            this.sentryService.captureError(error as Error, {
                operation: "getCategories",
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Get categories with advanced filtering and pagination
     * For admin interfaces and advanced search
     */
    async getCategoriesWithOptions(
        options: FindManyCategoriesOptions,
    ): Promise<{
        categories: CampaignCategory[]
        total: number
        hasMore: boolean
    }> {
        try {
            const [categories, total] = await Promise.all([
                this.categoryRepository.findMany(options),
                this.categoryRepository.count(
                    options.search,
                    options.includeInactive,
                ),
            ])

            const hasMore = (options.offset || 0) + categories.length < total

            return {
                categories,
                total,
                hasMore,
            }
        } catch (error) {
            this.logger.error("Failed to get categories with options:", error)
            this.sentryService.captureError(error as Error, {
                operation: "getCategoriesWithOptions",
                options,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Find category by ID
     */
    async findCategoryById(id: string): Promise<CampaignCategory> {
        try {
            const category = await this.categoryRepository.findById(id)
            if (category == null) {
                throw new NotFoundException(`Category with ID ${id} not found`)
            }
            return category
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.logger.error(`Failed to find category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "findCategoryById",
                categoryId: id,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Update category
     */
    async updateCategory(
        id: string,
        input: UpdateCampaignCategoryInput,
    ): Promise<CampaignCategory> {
        try {
            await this.findCategoryById(id)

            if (input.title !== undefined) {
                this.validateCategoryInput(input.title, input.description)

                const existingCategories =
                    await this.categoryRepository.findMany({
                        search: input.title,
                        limit: 10,
                    })

                const isDuplicate = existingCategories.some(
                    (category) =>
                        category.id !== id &&
                        category.title.toLowerCase() ===
                            input.title!.toLowerCase(),
                )

                if (isDuplicate) {
                    throw new BadRequestException(
                        `Category with title "${input.title}" already exists`,
                    )
                }
            }

            const updateData: any = {}

            if (input.title !== undefined) {
                updateData.title = input.title.trim()
            }

            if (input.description !== undefined) {
                updateData.description = input.description.trim()
            }

            if (Object.keys(updateData).length === 0) {
                throw new BadRequestException(
                    "At least one field (title or description) must be provided for update",
                )
            }

            const category = await this.categoryRepository.update(
                id,
                updateData,
            )

            this.sentryService.addBreadcrumb("Category updated", "category", {
                categoryId: id,
                title: category.title,
                updateFields: Object.keys(updateData),
            })

            return category
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error
            }
            this.logger.error(`Failed to update category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "updateCategory",
                categoryId: id,
                input,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Soft delete category
     */
    async deleteCategory(id: string): Promise<boolean> {
        try {
            // Validate that category exists
            await this.findCategoryById(id)

            const result = await this.categoryRepository.delete(id)

            if (result) {
                this.sentryService.addBreadcrumb(
                    "Category deleted",
                    "category",
                    { categoryId: id },
                )
                this.logger.log(`Deleted category: ${id}`)
            }

            return result
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.logger.error(`Failed to delete category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "deleteCategory",
                categoryId: id,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Reactivate category
     * Admin function to restore soft-deleted categories
     */
    async reactivateCategory(id: string): Promise<CampaignCategory> {
        try {
            const category = await this.categoryRepository.reactivate(id)
            if (!category) {
                throw new NotFoundException(
                    `Inactive category with ID ${id} not found`,
                )
            }

            this.sentryService.addBreadcrumb(
                "Category reactivated",
                "category",
                { categoryId: id, title: category.title },
            )

            this.logger.log(`Reactivated category: ${category.title} (${id})`)
            return category
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.logger.error(`Failed to reactivate category ${id}:`, error)
            this.sentryService.captureError(error as Error, {
                operation: "reactivateCategory",
                categoryId: id,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Get categories with campaign statistics
     * For admin dashboards and analytics
     */
    async getCategoriesWithStats(): Promise<
        Array<CampaignCategory & { campaignCount: number }>
        > {
        try {
            return await this.categoryRepository.findWithCampaignCounts()
        } catch (error) {
            this.logger.error("Failed to get categories with stats:", error)
            this.sentryService.captureError(error as Error, {
                operation: "getCategoryStats",
                service: "campaign-category-service",
            })
            throw error
        }
    }

    /**
     * Validate category exists (for campaign service integration)
     */
    async validateCategoryExists(categoryId: string): Promise<void> {
        try {
            const isActive =
                await this.categoryRepository.isCategoryActive(categoryId)
            if (!isActive) {
                throw new BadRequestException(
                    `Campaign category with ID ${categoryId} not found or inactive`,
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            this.logger.error(
                `Failed to validate category ${categoryId}:`,
                error,
            )
            this.sentryService.captureError(error as Error, {
                operation: "validateCategoryExists",
                categoryId,
                service: "campaign-category-service",
            })
            throw new BadRequestException("Invalid category ID provided")
        }
    }

    /**
     * Validate category input data
     */
    private validateCategoryInput(title: string, description?: string): void {
        if (!title || title.trim().length === 0) {
            throw new BadRequestException("Category title is required")
        }

        if (title.trim().length > 100) {
            throw new BadRequestException(
                "Category title must be 100 characters or less",
            )
        }

        if (description && description.trim().length > 1000) {
            throw new BadRequestException(
                "Category description must be 1000 characters or less",
            )
        }

        const harmfulPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        ]
        const contentToCheck = `${title} ${description || ""}`

        for (const pattern of harmfulPatterns) {
            if (pattern.test(contentToCheck)) {
                throw new BadRequestException(
                    "Invalid content detected in category data",
                )
            }
        }
    }

    /**
     * Health check for service
     */
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        try {
            return await this.categoryRepository.healthCheck()
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "categoryServiceHealthCheck",
                service: "campaign-category-service",
            })
            throw error
        }
    }
}
