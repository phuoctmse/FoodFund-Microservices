import { SentryService } from "@libs/observability"
import { AuthorizationService } from "../../shared"
import { CampaignCategoryRepository } from "../repository"
import {
    CampaignCategoryCacheService,
    CampaignCategoryService,
} from "../services"
import { CampaignCategory } from "../models"
import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"

describe("CampaignCategoryService", () => {
    let service: CampaignCategoryService
    let repository: jest.Mocked<CampaignCategoryRepository>
    let cacheService: jest.Mocked<CampaignCategoryCacheService>
    let authService: jest.Mocked<AuthorizationService>
    let sentryService: jest.Mocked<SentryService>

    // Mock data
    const mockCategory: CampaignCategory = {
        id: "cat-123",
        title: "Cứu trợ thiên tai",
        description: "Hỗ trợ người dân vùng bị thiên tai",
        isActive: true,
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-01-01"),
        campaigns: undefined,
    }

    const mockAdminToken = {
        sub: "admin-123",
        username: "admin@foodfund.com",
        "custom:role": "ADMIN",
        email: "admin@foodfund.com",
    }

    const mockDonorToken = {
        sub: "donor-123",
        username: "donor@foodfund.com",
        "custom:role": "DONOR",
        email: "donor@foodfund.com",
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CampaignCategoryService,
                {
                    provide: CampaignCategoryRepository,
                    useValue: {
                        create: jest.fn(),
                        findById: jest.fn(),
                        findMany: jest.fn(),
                        update: jest.fn(),
                        delete: jest.fn(),
                        reactivate: jest.fn(),
                        count: jest.fn(),
                        findWithCampaignCounts: jest.fn(),
                        isCategoryActive: jest.fn(),
                        healthCheck: jest.fn(),
                    },
                },
                {
                    provide: CampaignCategoryCacheService,
                    useValue: {
                        getCategory: jest.fn(),
                        setCategory: jest.fn(),
                        deleteCategory: jest.fn(),
                        getAllActiveCategories: jest.fn(),
                        setAllActiveCategories: jest.fn(),
                        deleteAllActiveCategories: jest.fn(),
                        getAllCategoriesWithInactive: jest.fn(),
                        setAllCategoriesWithInactive: jest.fn(),
                        deleteAllCategoriesWithInactive: jest.fn(),
                        getCategoryStats: jest.fn(),
                        setCategoryStats: jest.fn(),
                        deleteCategoryStats: jest.fn(),
                        invalidateAll: jest.fn(),
                        warmUpCache: jest.fn(),
                        getHealthStatus: jest.fn(),
                    },
                },
                {
                    provide: AuthorizationService,
                    useValue: {
                        requireAdmin: jest.fn(),
                        requireAuthentication: jest.fn(),
                        requireOwnership: jest.fn(),
                    },
                },
                {
                    provide: SentryService,
                    useValue: {
                        addBreadcrumb: jest.fn(),
                        captureError: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<CampaignCategoryService>(CampaignCategoryService)
        repository = module.get(CampaignCategoryRepository)
        cacheService = module.get(CampaignCategoryCacheService)
        authService = module.get(AuthorizationService)
        sentryService = module.get(SentryService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    // ==================== CREATE CATEGORY ====================

    describe("createCategory", () => {
        const createInput = {
            title: "Hỗ trợ giáo dục",
            description: "Chiến dịch hỗ trợ học sinh nghèo",
        }

        describe("Normal values (Happy path)", () => {
            it("should create category successfully with valid input", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([])
                repository.create.mockResolvedValue(mockCategory)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCategory(
                    createInput,
                    mockAdminToken,
                )

                // Assert
                expect(authService.requireAdmin).toHaveBeenCalledWith(
                    expect.objectContaining({
                        userId: "admin-123",
                        role: "ADMIN",
                    }),
                    "create campaign category",
                )
                expect(repository.create).toHaveBeenCalledWith({
                    title: createInput.title.trim(),
                    description: createInput.description.trim(),
                })
                expect(cacheService.invalidateAll).toHaveBeenCalled()
                expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
                    "Category created",
                    "category",
                    expect.objectContaining({
                        categoryId: mockCategory.id,
                        title: mockCategory.title,
                    }),
                )
                expect(result).toEqual(mockCategory)
            })

            it("should trim whitespace from title and description", async () => {
                // Arrange
                const inputWithSpaces = {
                    title: "  Hỗ trợ giáo dục  ",
                    description: "  Description with spaces  ",
                }
                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([])
                repository.create.mockResolvedValue(mockCategory)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                await service.createCategory(inputWithSpaces, mockAdminToken)

                // Assert
                expect(repository.create).toHaveBeenCalledWith({
                    title: "Hỗ trợ giáo dục",
                    description: "Description with spaces",
                })
            })
        })

        describe("Boundary values", () => {
            it("should accept title with exactly 100 characters", async () => {
                // Arrange
                const titleWith100Chars = "a".repeat(100)
                const input = {
                    title: titleWith100Chars,
                    description: "Valid description",
                }
                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([])
                repository.create.mockResolvedValue(mockCategory)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                await service.createCategory(input, mockAdminToken)

                // Assert
                expect(repository.create).toHaveBeenCalled()
            })

            it("should accept description with exactly 1000 characters", async () => {
                // Arrange
                const descWith1000Chars = "a".repeat(1000)
                const input = {
                    title: "Valid Title",
                    description: descWith1000Chars,
                }
                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([])
                repository.create.mockResolvedValue(mockCategory)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                await service.createCategory(input, mockAdminToken)

                // Assert
                expect(repository.create).toHaveBeenCalled()
            })

            it("should reject title with 101 characters", async () => {
                // Arrange
                const titleWith101Chars = "a".repeat(101)
                const input = {
                    title: titleWith101Chars,
                    description: "Valid description",
                }
                authService.requireAdmin.mockReturnValue(undefined)

                // Act & Assert
                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Category title must be 100 characters or less",
                    ),
                )
            })

            it("should reject description with 1001 characters", async () => {
                // Arrange
                const descWith1001Chars = "a".repeat(1001)
                const input = {
                    title: "Valid Title",
                    description: descWith1001Chars,
                }
                authService.requireAdmin.mockReturnValue(undefined)

                // Act & Assert
                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Category description must be 1000 characters or less",
                    ),
                )
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw ForbiddenException when user is not admin", async () => {
                // Arrange
                authService.requireAdmin.mockImplementation(() => {
                    throw new BadRequestException(
                        "Only users with ADMIN role can create campaign category. Your role: DONOR",
                    )
                })

                // Act & Assert
                await expect(
                    service.createCategory(createInput, mockDonorToken),
                ).rejects.toThrow(BadRequestException)
                expect(repository.create).not.toHaveBeenCalled()
            })

            it("should throw BadRequestException when title is empty", async () => {
                // Arrange
                const input = { title: "", description: "Valid description" }
                authService.requireAdmin.mockReturnValue(undefined)

                // Act & Assert
                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException("Category title is required"),
                )
            })

            it("should throw BadRequestException when title is only whitespace", async () => {
                const input = { title: "   ", description: "Valid description" }
                authService.requireAdmin.mockReturnValue(undefined)

                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException("Category title is required"),
                )
            })

            it("should throw BadRequestException when category title already exists", async () => {
                const existingCategoryWithSameTitle: CampaignCategory = {
                    id: "existing-cat-456",
                    title: createInput.title,
                    description: "Existing category description",
                    isActive: true,
                    created_at: new Date("2024-12-01"),
                    updated_at: new Date("2024-12-01"),
                    campaigns: undefined,
                }

                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([
                    existingCategoryWithSameTitle,
                ])
                await expect(
                    service.createCategory(createInput, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        `Category with title "${createInput.title}" already exists`,
                    ),
                )
                expect(repository.create).not.toHaveBeenCalled()
            })

            it("should throw BadRequestException when title contains script tag", async () => {
                const input = {
                    title: "Test<script>alert('xss')</script>",
                    description: "Valid description",
                }
                authService.requireAdmin.mockReturnValue(undefined)

                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Invalid content detected in category data",
                    ),
                )
            })

            it("should throw BadRequestException when description contains iframe", async () => {
                const input = {
                    title: "Valid Title",
                    description: "Test<iframe src='evil.com'></iframe>",
                }
                authService.requireAdmin.mockReturnValue(undefined)

                await expect(
                    service.createCategory(input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Invalid content detected in category data",
                    ),
                )
            })

            it("should capture error to Sentry when repository throws error", async () => {
                authService.requireAdmin.mockReturnValue(undefined)
                repository.findMany.mockResolvedValue([])
                const dbError = new Error("Database connection failed")
                repository.create.mockRejectedValue(dbError)

                await expect(
                    service.createCategory(createInput, mockAdminToken),
                ).rejects.toThrow(dbError)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "createCategory",
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })

    // ==================== GET CATEGORIES ====================

    describe("getCategories", () => {
        const mockCategories: CampaignCategory[] = [
            mockCategory,
            {
                ...mockCategory,
                id: "cat-456",
                title: "Hỗ trợ y tế",
            },
        ]

        describe("Normal values (Happy path)", () => {
            it("should return categories from cache when available", async () => {
                // Arrange
                cacheService.getAllActiveCategories.mockResolvedValue(
                    mockCategories,
                )

                // Act
                const result = await service.getCategories()

                // Assert
                expect(cacheService.getAllActiveCategories).toHaveBeenCalled()
                expect(repository.findMany).not.toHaveBeenCalled()
                expect(result).toEqual(mockCategories)
            })

            it("should fetch from database and cache when cache miss", async () => {
                // Arrange
                cacheService.getAllActiveCategories.mockResolvedValue(null)
                repository.findMany.mockResolvedValue(mockCategories)
                cacheService.setAllActiveCategories.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategories()

                // Assert
                expect(cacheService.getAllActiveCategories).toHaveBeenCalled()
                expect(repository.findMany).toHaveBeenCalledWith({
                    limit: 100,
                    includeInactive: false,
                })
                expect(
                    cacheService.setAllActiveCategories,
                ).toHaveBeenCalledWith(mockCategories)
                expect(result).toEqual(mockCategories)
            })
        })

        describe("Boundary values", () => {
            it("should return empty array when no categories exist", async () => {
                // Arrange
                cacheService.getAllActiveCategories.mockResolvedValue(null)
                repository.findMany.mockResolvedValue([])
                cacheService.setAllActiveCategories.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategories()

                // Assert
                expect(result).toEqual([])
                expect(
                    cacheService.setAllActiveCategories,
                ).toHaveBeenCalledWith([])
            })

            it("should handle exactly 100 categories (limit)", async () => {
                // Arrange
                const categories100 = Array(100).fill(mockCategory)
                cacheService.getAllActiveCategories.mockResolvedValue(null)
                repository.findMany.mockResolvedValue(categories100)
                cacheService.setAllActiveCategories.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategories()

                // Assert
                expect(result).toHaveLength(100)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should capture error when repository fails", async () => {
                // Arrange
                cacheService.getAllActiveCategories.mockResolvedValue(null)
                const dbError = new Error("Database error")
                repository.findMany.mockRejectedValue(dbError)

                // Act & Assert
                await expect(service.getCategories()).rejects.toThrow(dbError)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "getCategories",
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })

    // ==================== FIND CATEGORY BY ID ====================

    describe("findCategoryById", () => {
        const categoryId = "cat-123"

        describe("Normal values (Happy path)", () => {
            it("should return category from cache when available", async () => {
                // Arrange
                cacheService.getCategory.mockResolvedValue(mockCategory)

                // Act
                const result = await service.findCategoryById(categoryId)

                // Assert
                expect(cacheService.getCategory).toHaveBeenCalledWith(
                    categoryId,
                )
                expect(repository.findById).not.toHaveBeenCalled()
                expect(result).toEqual(mockCategory)
            })

            it("should fetch from database and cache when cache miss", async () => {
                // Arrange
                cacheService.getCategory.mockResolvedValue(null)
                repository.findById.mockResolvedValue(mockCategory)
                cacheService.setCategory.mockResolvedValue(undefined)

                // Act
                const result = await service.findCategoryById(categoryId)

                // Assert
                expect(cacheService.getCategory).toHaveBeenCalledWith(
                    categoryId,
                )
                expect(repository.findById).toHaveBeenCalledWith(categoryId)
                expect(cacheService.setCategory).toHaveBeenCalledWith(
                    categoryId,
                    mockCategory,
                )
                expect(result).toEqual(mockCategory)
            })
        })

        describe("Boundary values", () => {
            it("should handle UUID with different formats", async () => {
                // Arrange
                const validUUIDs = [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "550e8400-e29b-41d4-a716-446655440000",
                ]

                for (const uuid of validUUIDs) {
                    cacheService.getCategory.mockResolvedValue(null)
                    repository.findById.mockResolvedValue(mockCategory)
                    cacheService.setCategory.mockResolvedValue(undefined)

                    // Act
                    const result = await service.findCategoryById(uuid)

                    // Assert
                    expect(result).toEqual(mockCategory)
                }
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw NotFoundException when category does not exist", async () => {
                // Arrange
                cacheService.getCategory.mockResolvedValue(null)
                repository.findById.mockResolvedValue(null)

                // Act & Assert
                await expect(
                    service.findCategoryById(categoryId),
                ).rejects.toThrow(
                    new NotFoundException(
                        `Category with ID ${categoryId} not found`,
                    ),
                )
                expect(cacheService.setCategory).not.toHaveBeenCalled()
            })

            it("should capture error when repository fails", async () => {
                // Arrange
                cacheService.getCategory.mockResolvedValue(null)
                const dbError = new Error("Database error")
                repository.findById.mockRejectedValue(dbError)

                // Act & Assert
                await expect(
                    service.findCategoryById(categoryId),
                ).rejects.toThrow(dbError)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "findCategoryById",
                        categoryId,
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })

    // ==================== UPDATE CATEGORY ====================

    describe("updateCategory", () => {
        const categoryId = "cat-123"
        const updateInput = {
            title: "Updated Title",
            description: "Updated Description",
        }

        describe("Normal values (Happy path)", () => {
            it("should update category successfully with valid input", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.findMany.mockResolvedValue([])
                repository.update.mockResolvedValue({
                    ...mockCategory,
                    ...updateInput,
                })
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.updateCategory(
                    categoryId,
                    updateInput,
                    mockAdminToken,
                )

                // Assert
                expect(authService.requireAdmin).toHaveBeenCalledWith(
                    expect.objectContaining({ userId: "admin-123" }),
                    "update campaign category",
                )
                expect(repository.update).toHaveBeenCalledWith(categoryId, {
                    title: updateInput.title.trim(),
                    description: updateInput.description.trim(),
                })
                expect(cacheService.invalidateAll).toHaveBeenCalledWith(
                    categoryId,
                )
                expect(result.title).toBe(updateInput.title)
            })

            it("should allow partial update (title only)", async () => {
                // Arrange
                const partialInput = { title: "New Title Only" }
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.findMany.mockResolvedValue([])
                repository.update.mockResolvedValue({
                    ...mockCategory,
                    ...partialInput,
                })
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.updateCategory(
                    categoryId,
                    partialInput,
                    mockAdminToken,
                )

                // Assert
                expect(repository.update).toHaveBeenCalledWith(categoryId, {
                    title: partialInput.title.trim(),
                })
                expect(result).toBeDefined()
            })

            it("should allow partial update (description only)", async () => {
                // Arrange
                const partialInput = { description: "New Description Only" }
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.update.mockResolvedValue({
                    ...mockCategory,
                    ...partialInput,
                })
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.updateCategory(
                    categoryId,
                    partialInput,
                    mockAdminToken,
                )

                // Assert
                expect(repository.update).toHaveBeenCalledWith(categoryId, {
                    description: partialInput.description.trim(),
                })
                expect(result).toBeDefined()
            })
        })

        describe("Boundary values", () => {
            it("should accept title with exactly 100 characters", async () => {
                // Arrange
                const input = {
                    title: "a".repeat(100),
                    description: "Valid",
                }
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.findMany.mockResolvedValue([])
                repository.update.mockResolvedValue({
                    ...mockCategory,
                    ...input,
                })
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                await service.updateCategory(categoryId, input, mockAdminToken)

                // Assert
                expect(repository.update).toHaveBeenCalled()
            })

            it("should reject title with 101 characters", async () => {
                // Arrange
                const input = { title: "a".repeat(101) }
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)

                // Act & Assert
                await expect(
                    service.updateCategory(categoryId, input, mockAdminToken),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Category title must be 100 characters or less",
                    ),
                )
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw ForbiddenException when user is not admin", async () => {
                authService.requireAdmin.mockImplementation(() => {
                    throw new BadRequestException(
                        "Only users with ADMIN role can update campaign category",
                    )
                })

                await expect(
                    service.updateCategory(
                        categoryId,
                        updateInput,
                        mockDonorToken,
                    ),
                ).rejects.toThrow(BadRequestException)
                expect(repository.update).not.toHaveBeenCalled()
            })

            it("should throw NotFoundException when category does not exist", async () => {
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(null)
                repository.findById.mockResolvedValue(null)

                await expect(
                    service.updateCategory(
                        categoryId,
                        updateInput,
                        mockAdminToken,
                    ),
                ).rejects.toThrow(
                    new NotFoundException(
                        `Category with ID ${categoryId} not found`,
                    ),
                )
            })

            it("should throw BadRequestException when no fields provided", async () => {
                const emptyInput = {}
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)

                await expect(
                    service.updateCategory(
                        categoryId,
                        emptyInput,
                        mockAdminToken,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "At least one field (title or description) must be provided for update",
                    ),
                )
            })

            it("should throw BadRequestException when new title already exists", async () => {
                const existingCategoryWithSameTitle: CampaignCategory = {
                    id: "other-cat-id",
                    title: updateInput.title,
                    description: "Existing description",
                    isActive: true,
                    created_at: new Date("2024-12-01"),
                    updated_at: new Date("2024-12-01"),
                    campaigns: undefined,
                }

                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.findMany.mockResolvedValue([
                    existingCategoryWithSameTitle,
                ])

                await expect(
                    service.updateCategory(
                        categoryId,
                        updateInput,
                        mockAdminToken,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        `Category with title "${updateInput.title}" already exists`,
                    ),
                )
            })

            it("should throw BadRequestException when title contains malicious content", async () => {
                const maliciousInput = {
                    title: "Test<script>alert('xss')</script>",
                }
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)

                await expect(
                    service.updateCategory(
                        categoryId,
                        maliciousInput,
                        mockAdminToken,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Invalid content detected in category data",
                    ),
                )
            })
        })
    })

    // ==================== DELETE CATEGORY ====================

    describe("deleteCategory", () => {
        const categoryId = "cat-123"

        describe("Normal values (Happy path)", () => {
            it("should delete category successfully", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.delete.mockResolvedValue(true)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.deleteCategory(
                    categoryId,
                    mockAdminToken,
                )

                // Assert
                expect(authService.requireAdmin).toHaveBeenCalledWith(
                    expect.objectContaining({ userId: "admin-123" }),
                    "delete campaign category",
                )
                expect(repository.delete).toHaveBeenCalledWith(categoryId)
                expect(cacheService.invalidateAll).toHaveBeenCalledWith(
                    categoryId,
                )
                expect(sentryService.addBreadcrumb).toHaveBeenCalledWith(
                    "Category deleted",
                    "category",
                    expect.objectContaining({ categoryId }),
                )
                expect(result).toBe(true)
            })

            it("should return false when delete operation fails", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                repository.delete.mockResolvedValue(false)

                // Act
                const result = await service.deleteCategory(
                    categoryId,
                    mockAdminToken,
                )

                // Assert
                expect(result).toBe(false)
                expect(cacheService.invalidateAll).not.toHaveBeenCalled()
                expect(sentryService.addBreadcrumb).not.toHaveBeenCalled()
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw ForbiddenException when user is not admin", async () => {
                // Arrange
                authService.requireAdmin.mockImplementation(() => {
                    throw new BadRequestException(
                        "Only users with ADMIN role can delete campaign category",
                    )
                })

                // Act & Assert
                await expect(
                    service.deleteCategory(categoryId, mockDonorToken),
                ).rejects.toThrow(BadRequestException)
                expect(repository.delete).not.toHaveBeenCalled()
            })

            it("should throw NotFoundException when category does not exist", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(null)
                repository.findById.mockResolvedValue(null)

                // Act & Assert
                await expect(
                    service.deleteCategory(categoryId, mockAdminToken),
                ).rejects.toThrow(
                    new NotFoundException(
                        `Category with ID ${categoryId} not found`,
                    ),
                )
                expect(repository.delete).not.toHaveBeenCalled()
            })

            it("should capture error when repository fails", async () => {
                // Arrange
                authService.requireAdmin.mockReturnValue(undefined)
                cacheService.getCategory.mockResolvedValue(mockCategory)
                const dbError = new Error("Cannot delete: campaigns exist")
                repository.delete.mockRejectedValue(dbError)

                // Act & Assert
                await expect(
                    service.deleteCategory(categoryId, mockAdminToken),
                ).rejects.toThrow(dbError)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "deleteCategory",
                        categoryId,
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })

    // ==================== GET CATEGORIES WITH STATS ====================

    describe("getCategoriesWithStats", () => {
        const mockStats = [
            { ...mockCategory, campaignCount: 5 },
            { ...mockCategory, id: "cat-456", campaignCount: 10 },
        ]

        describe("Normal values (Happy path)", () => {
            it("should return stats from cache when available", async () => {
                // Arrange
                cacheService.getCategoryStats.mockResolvedValue(mockStats)

                // Act
                const result = await service.getCategoriesWithStats()

                // Assert
                expect(cacheService.getCategoryStats).toHaveBeenCalled()
                expect(repository.findWithCampaignCounts).not.toHaveBeenCalled()
                expect(result).toEqual(mockStats)
            })

            it("should fetch from database and cache when cache miss", async () => {
                // Arrange
                cacheService.getCategoryStats.mockResolvedValue(null)
                repository.findWithCampaignCounts.mockResolvedValue(mockStats)
                cacheService.setCategoryStats.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategoriesWithStats()

                // Assert
                expect(repository.findWithCampaignCounts).toHaveBeenCalled()
                expect(cacheService.setCategoryStats).toHaveBeenCalledWith(
                    mockStats,
                )
                expect(result).toEqual(mockStats)
            })
        })

        describe("Boundary values", () => {
            it("should handle categories with zero campaigns", async () => {
                // Arrange
                const statsWithZero = [{ ...mockCategory, campaignCount: 0 }]
                cacheService.getCategoryStats.mockResolvedValue(null)
                repository.findWithCampaignCounts.mockResolvedValue(
                    statsWithZero,
                )
                cacheService.setCategoryStats.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategoriesWithStats()

                // Assert
                expect(result[0].campaignCount).toBe(0)
            })

            it("should handle empty stats array", async () => {
                // Arrange
                cacheService.getCategoryStats.mockResolvedValue(null)
                repository.findWithCampaignCounts.mockResolvedValue([])
                cacheService.setCategoryStats.mockResolvedValue(undefined)

                // Act
                const result = await service.getCategoriesWithStats()

                // Assert
                expect(result).toEqual([])
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should capture error when repository fails", async () => {
                // Arrange
                cacheService.getCategoryStats.mockResolvedValue(null)
                const dbError = new Error("Database error")
                repository.findWithCampaignCounts.mockRejectedValue(dbError)

                // Act & Assert
                await expect(service.getCategoriesWithStats()).rejects.toThrow(
                    dbError,
                )
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "getCategoryStats",
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })
    // ==================== HEALTH CHECK ====================

    describe("healthCheck", () => {
        describe("Normal values (Happy path)", () => {
            it("should return health status from repository", async () => {
                // Arrange
                const healthStatus = {
                    status: "healthy",
                    timestamp: new Date().toISOString(),
                }
                repository.healthCheck.mockResolvedValue(healthStatus)

                // Act
                const result = await service.healthCheck()

                // Assert
                expect(repository.healthCheck).toHaveBeenCalled()
                expect(result).toEqual(healthStatus)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should capture error when health check fails", async () => {
                // Arrange
                const error = new Error("Health check failed")
                repository.healthCheck.mockRejectedValue(error)

                // Act & Assert
                await expect(service.healthCheck()).rejects.toThrow(error)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    error,
                    expect.objectContaining({
                        operation: "categoryServiceHealthCheck",
                        service: "campaign-category-service",
                    }),
                )
            })
        })
    })
})
