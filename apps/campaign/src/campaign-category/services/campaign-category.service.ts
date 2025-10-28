import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import {
    CreateCampaignCategoryInput,
    UpdateCampaignCategoryInput,
} from "../dtos/request/campaign-category.input"
import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { CampaignCategoryCacheService } from "./campaign-category-cache.service"
import {
    CampaignCategoryRepository,
    FindManyCategoriesOptions,
} from "../repository"
import { AuthorizationService, createUserContextFromToken } from "../../shared"

@Injectable()
export class CampaignCategoryService {
    constructor(
        private readonly categoryRepository: CampaignCategoryRepository,
        private readonly sentryService: SentryService,
        private readonly cacheService: CampaignCategoryCacheService,
        private readonly authorizationService: AuthorizationService,
    ) {}

    async createCategory(
        input: CreateCampaignCategoryInput,
        decodedToken: any,
    ): Promise<CampaignCategory> {
        const userContext = createUserContextFromToken(decodedToken)

        this.authorizationService.requireAdmin(
            userContext,
            "create campaign category",
        )

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

            await this.cacheService.invalidateAll()

            this.sentryService.addBreadcrumb("Category created", "category", {
                categoryId: category.id,
                title: category.title,
                createdBy: {
                    userId: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
            })

            return category
        } catch (error) {
            if (!(error instanceof BadRequestException)) {
                this.sentryService.captureError(error as Error, {
                    operation: "createCategory",
                    input: {
                        title: input.title,
                        hasDescription: !!input.description,
                    },
                    user: {
                        userId: userContext.userId,
                        role: userContext.role,
                    },
                    service: "campaign-category-service",
                })
            }
            throw error
        }
    }

    async getCategories(): Promise<CampaignCategory[]> {
        try {
            const cached = await this.cacheService.getAllActiveCategories()
            if (cached) {
                return cached
            }
            const categories = await this.categoryRepository.findMany({
                limit: 100,
                includeInactive: false,
            })
            await this.cacheService.setAllActiveCategories(categories)
            return categories
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getCategories",
                service: "campaign-category-service",
            })
            throw error
        }
    }

    async getCategoriesWithOptions(
        options: FindManyCategoriesOptions,
    ): Promise<{
        categories: CampaignCategory[]
        total: number
        hasMore: boolean
    }> {
        try {
            if (
                !options.search &&
                (options.limit || 50) === 50 &&
                (options.offset || 0) === 0
            ) {
                const cacheKey = options.includeInactive
                    ? await this.cacheService.getAllCategoriesWithInactive()
                    : await this.cacheService.getAllActiveCategories()

                if (cacheKey) {
                    return {
                        categories: cacheKey,
                        total: cacheKey.length,
                        hasMore: false,
                    }
                }
            }

            const [categories, total] = await Promise.all([
                this.categoryRepository.findMany(options),
                this.categoryRepository.count(
                    options.search,
                    options.includeInactive,
                ),
            ])

            const hasMore = (options.offset || 0) + categories.length < total

            if (
                !options.search &&
                (options.limit || 50) === 50 &&
                (options.offset || 0) === 0
            ) {
                if (options.includeInactive) {
                    await this.cacheService.setAllCategoriesWithInactive(
                        categories,
                    )
                } else {
                    await this.cacheService.setAllActiveCategories(categories)
                }
            }

            return {
                categories,
                total,
                hasMore,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getCategoriesWithOptions",
                options,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    async findCategoryById(id: string): Promise<CampaignCategory> {
        try {
            const cached = await this.cacheService.getCategory(id)
            if (cached) {
                return cached
            }

            const category = await this.categoryRepository.findById(id)
            if (category == null) {
                throw new NotFoundException(`Category with ID ${id} not found`)
            }

            await this.cacheService.setCategory(id, category)

            return category
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.sentryService.captureError(error as Error, {
                operation: "findCategoryById",
                categoryId: id,
                service: "campaign-category-service",
            })
            throw error
        }
    }

    async updateCategory(
        id: string,
        input: UpdateCampaignCategoryInput,
        decodedToken: any,
    ): Promise<CampaignCategory> {
        const userContext = createUserContextFromToken(decodedToken)

        this.authorizationService.requireAdmin(
            userContext,
            "update campaign category",
        )

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

            await this.cacheService.invalidateAll(id)

            this.sentryService.addBreadcrumb("Category updated", "category", {
                categoryId: id,
                title: category.title,
                updateFields: Object.keys(updateData),
                updatedBy: {
                    userId: userContext.userId,
                    username: userContext.username,
                    role: userContext.role,
                },
            })

            return category
        } catch (error) {
            if (
                !(error instanceof NotFoundException) &&
                !(error instanceof BadRequestException)
            ) {
                this.sentryService.captureError(error as Error, {
                    operation: "updateCategory",
                    categoryId: id,
                    input,
                    user: {
                        userId: userContext.userId,
                        role: userContext.role,
                    },
                    service: "campaign-category-service",
                })
            }
            throw error
        }
    }

    async deleteCategory(id: string, decodedToken: any): Promise<boolean> {
        const userContext = createUserContextFromToken(decodedToken)

        this.authorizationService.requireAdmin(
            userContext,
            "delete campaign category",
        )

        try {
            await this.findCategoryById(id)

            const result = await this.categoryRepository.delete(id)

            if (result) {
                await this.cacheService.invalidateAll(id)

                this.sentryService.addBreadcrumb(
                    "Category deleted",
                    "category",
                    {
                        categoryId: id,
                        deletedBy: {
                            userId: userContext.userId,
                            username: userContext.username,
                            role: userContext.role,
                        },
                    },
                )
            }

            return result
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            this.sentryService.captureError(error as Error, {
                operation: "deleteCategory",
                categoryId: id,
                user: {
                    userId: userContext.userId,
                    role: userContext.role,
                },
                service: "campaign-category-service",
            })
            throw error
        }
    }

    async getCategoriesWithStats(): Promise<
        Array<CampaignCategory & { campaignCount: number }>
        > {
        try {
            const cached = await this.cacheService.getCategoryStats()
            if (cached) {
                return cached
            }

            const stats = await this.categoryRepository.findWithCampaignCounts()
            await this.cacheService.setCategoryStats(stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getCategoryStats",
                service: "campaign-category-service",
            })
            throw error
        }
    }

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
            this.sentryService.captureError(error as Error, {
                operation: "validateCategoryExists",
                categoryId,
                service: "campaign-category-service",
            })
            throw new BadRequestException("Invalid category ID provided")
        }
    }

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
