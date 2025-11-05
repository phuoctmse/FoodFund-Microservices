import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, ForbiddenException } from "@nestjs/common"
import { CampaignService } from "../services/campaign.service"
import { CampaignRepository } from "../repository/campaign.repository"
import { CampaignCacheService } from "../services/campaign-cache.service"
import { CampaignCategoryRepository } from "../../campaign-category/repository/campaign-category.repository"
import { SentryService } from "@libs/observability/sentry.service"
import { SpacesUploadService } from "libs/s3-storage/spaces-upload.service"
import { AuthorizationService } from "../../shared/services/authorization.service"
import { Campaign } from "../models/campaign.model"
import { CampaignStatus } from "../enum/campaign.enum"
import {
    CampaignNotFoundException,
    CampaignCannotBeDeletedException,
} from "../exceptions/campaign.exception"
import { Role, UserContext } from "../../shared"
import { CampaignPhaseService } from "../../campaign-phase"

describe("CampaignService", () => {
    let service: CampaignService
    let repository: jest.Mocked<CampaignRepository>
    let cacheService: jest.Mocked<CampaignCacheService>
    let categoryRepository: jest.Mocked<CampaignCategoryRepository>
    let sentryService: jest.Mocked<SentryService>
    let spacesUploadService: jest.Mocked<SpacesUploadService>
    let authService: jest.Mocked<AuthorizationService>
    let phaseService: jest.Mocked<CampaignPhaseService>

    // Mock user contexts
    const mockUserContext: UserContext = {
        userId: "user-123",
        username: "testuser",
        role: Role.DONOR,
    }

    const mockAdminContext: UserContext = {
        userId: "admin-123",
        username: "admin",
        role: Role.ADMIN,
    }

    const mockCampaign: Campaign = {
        id: "campaign-123",
        title: "Test Campaign",
        description: "Test Description",
        coverImage: "https://cdn.example.com/campaigns/image.jpg",
        coverImageFileKey: "campaigns/user-123/image.jpg",
        targetAmount: "10000000",
        donationCount: 0,
        receivedAmount: "5000000",
        ingredientBudgetPercentage: "60.00",
        cookingBudgetPercentage: "30.00",
        deliveryBudgetPercentage: "10.00",
        status: CampaignStatus.PENDING,
        fundraisingStartDate: new Date("2025-02-01"),
        fundraisingEndDate: new Date("2025-03-01"),
        ingredientFundsAmount: undefined,
        cookingFundsAmount: undefined,
        deliveryFundsAmount: undefined,
        extensionCount: 0,
        extensionDays: 0,
        isActive: true,
        createdBy: "user-123",
        categoryId: "category-123",
        changedStatusAt: undefined,
        completedAt: undefined,
        created_at: new Date("2025-01-01"),
        updated_at: new Date("2025-01-01"),
        category: undefined,
        creator: undefined,
        phases: [],
    }

    const mockCategory = {
        id: "category-123",
        title: "Test Category",
        description: "Test Category Description",
        isActive: true,
        created_at: new Date(),
        updated_at: new Date(),
        campaigns: undefined,
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CampaignService,
                {
                    provide: CampaignRepository,
                    useValue: {
                        create: jest.fn(),
                        findById: jest.fn(),
                        findMany: jest.fn(),
                        update: jest.fn(),
                        delete: jest.fn(),
                        count: jest.fn(),
                        healthCheck: jest.fn(),
                    },
                },
                {
                    provide: CampaignCacheService,
                    useValue: {
                        getCampaign: jest.fn(),
                        setCampaign: jest.fn(),
                        deleteCampaign: jest.fn(),
                        getCampaignList: jest.fn(),
                        setCampaignList: jest.fn(),
                        deleteAllCampaignLists: jest.fn(),
                        getUserCampaigns: jest.fn(),
                        setUserCampaigns: jest.fn(),
                        deleteUserCampaigns: jest.fn(),
                        getCategoryCampaigns: jest.fn(),
                        setCategoryCampaigns: jest.fn(),
                        deleteCategoryCampaigns: jest.fn(),
                        getActiveCampaigns: jest.fn(),
                        setActiveCampaigns: jest.fn(),
                        deleteActiveCampaigns: jest.fn(),
                        invalidateAll: jest.fn(),
                        warmUpCache: jest.fn(),
                        getHealthStatus: jest.fn(),
                    },
                },
                {
                    provide: CampaignCategoryRepository,
                    useValue: {
                        findById: jest.fn(),
                        findMany: jest.fn(),
                    },
                },
                {
                    provide: SentryService,
                    useValue: {
                        addBreadcrumb: jest.fn(),
                        captureError: jest.fn(),
                    },
                },
                {
                    provide: SpacesUploadService,
                    useValue: {
                        generateImageUploadUrl: jest.fn(),
                        validateUploadedFile: jest.fn(),
                        extractFileKeyFromUrl: jest.fn(),
                        deleteResourceImage: jest.fn(),
                    },
                },
                {
                    provide: AuthorizationService,
                    useValue: {
                        requireAuthentication: jest.fn(),
                        requireAdmin: jest.fn(),
                        requireOwnership: jest.fn(),
                    },
                },
                {
                    provide: CampaignPhaseService,
                    useValue: {
                        createPhase: jest.fn(),
                        getPhasesByCampaignId: jest.fn(),
                        getPhaseById: jest.fn(),
                        updatePhase: jest.fn(),
                        deletePhase: jest.fn(),
                        deleteManyPhases: jest.fn(),
                        validatePhaseDates: jest.fn(),
                    },
                },
            ],
        }).compile()

        service = module.get<CampaignService>(CampaignService)
        repository = module.get(CampaignRepository)
        cacheService = module.get(CampaignCacheService)
        categoryRepository = module.get(CampaignCategoryRepository)
        sentryService = module.get(SentryService)
        spacesUploadService = module.get(SpacesUploadService)
        authService = module.get(AuthorizationService)
        phaseService = module.get(CampaignPhaseService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    // ==================== HELPER FUNCTION ====================
    const getCreateInput = () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)

        const nextMonth = new Date(tomorrow)
        nextMonth.setMonth(nextMonth.getMonth() + 1)

        // ✅ Add at least one phase to satisfy validation
        const phaseDate1 = new Date(nextMonth)
        phaseDate1.setDate(phaseDate1.getDate() + 1)
        const phaseDate2 = new Date(phaseDate1)
        phaseDate2.setDate(phaseDate2.getDate() + 1)
        const phaseDate3 = new Date(phaseDate2)
        phaseDate3.setDate(phaseDate3.getDate() + 1)

        return {
            title: "New Campaign",
            description:
                "Campaign Description with sufficient length to meet validation requirements",
            coverImageFileKey: "campaigns/user-123/image.jpg",
            targetAmount: "10000000",
            categoryId: "category-123",
            ingredientBudgetPercentage: "60.00",
            cookingBudgetPercentage: "30.00",
            deliveryBudgetPercentage: "10.00",
            fundraisingStartDate: tomorrow,
            fundraisingEndDate: nextMonth,
            phases: [
                {
                    phaseName: "Phase 1 - Test District",
                    location: "District 1, HCMC",
                    ingredientPurchaseDate: phaseDate1,
                    cookingDate: phaseDate2,
                    deliveryDate: phaseDate3,
                },
            ],
        }
    }

    // ==================== GENERATE UPLOAD URL ====================

    describe("generateCampaignImageUploadUrl", () => {
        const mockUploadResult = {
            uploadUrl: "https://spaces.example.com/upload",
            fileKey: "campaigns/user-123/test.jpg",
            expiresAt: new Date("2025-01-02"),
            cdnUrl: "https://cdn.example.com/campaigns/user-123/test.jpg",
        }

        describe("Normal values (Happy path)", () => {
            it("should generate upload URL successfully for new campaign", async () => {
                // Arrange
                const input = { fileType: "jpeg" }
                authService.requireAuthentication.mockReturnValue(undefined)
                spacesUploadService.generateImageUploadUrl.mockResolvedValue(
                    mockUploadResult,
                )

                // Act
                const result = await service.generateCampaignImageUploadUrl(
                    input,
                    mockUserContext,
                )

                // Assert
                expect(authService.requireAuthentication).toHaveBeenCalledWith(
                    mockUserContext,
                    "generate upload URL",
                )
                expect(
                    spacesUploadService.generateImageUploadUrl,
                ).toHaveBeenCalledWith(
                    mockUserContext.userId,
                    "campaigns",
                    undefined,
                )
                expect(result).toEqual({
                    ...mockUploadResult,
                    instructions: expect.any(String),
                })
            })

            it("should generate upload URL for existing campaign (update)", async () => {
                // Arrange
                const input = {
                    campaignId: "campaign-123",
                    fileType: "jpeg",
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(mockCampaign)
                authService.requireOwnership.mockReturnValue(undefined)
                spacesUploadService.generateImageUploadUrl.mockResolvedValue(
                    mockUploadResult,
                )

                // Act
                const result = await service.generateCampaignImageUploadUrl(
                    input,
                    mockUserContext,
                )

                // Assert
                expect(authService.requireOwnership).toHaveBeenCalledWith(
                    mockCampaign.createdBy,
                    mockUserContext,
                    "campaign",
                    "generate upload URL",
                )
                expect(result.fileKey).toBe(mockUploadResult.fileKey)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw error when user not authenticated", async () => {
                // Arrange
                const input = { fileType: "jpeg" }
                authService.requireAuthentication.mockImplementation(() => {
                    throw new ForbiddenException("Authentication required")
                })

                // Act & Assert
                await expect(
                    service.generateCampaignImageUploadUrl(
                        input,
                        mockUserContext,
                    ),
                ).rejects.toThrow(ForbiddenException)
            })

            it("should throw error when campaign not found", async () => {
                // Arrange
                const input = {
                    campaignId: "non-existent",
                    fileType: "jpeg",
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(null)
                repository.findById.mockResolvedValue(null)

                // Act & Assert
                await expect(
                    service.generateCampaignImageUploadUrl(
                        input,
                        mockUserContext,
                    ),
                ).rejects.toThrow(CampaignNotFoundException)
            })

            it("should throw error when user not campaign owner", async () => {
                // Arrange
                const input = {
                    campaignId: "campaign-123",
                    fileType: "jpeg",
                }
                const otherUserContext = {
                    ...mockUserContext,
                    userId: "other-user",
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(mockCampaign)
                authService.requireOwnership.mockImplementation(() => {
                    throw new ForbiddenException("Not campaign owner")
                })

                // Act & Assert
                await expect(
                    service.generateCampaignImageUploadUrl(
                        input,
                        otherUserContext,
                    ),
                ).rejects.toThrow(ForbiddenException)
            })
        })
    })

    // ==================== CREATE CAMPAIGN ====================

    describe("createCampaign", () => {
        describe("Normal values (Happy path)", () => {
            it("should create campaign successfully with valid input", async () => {
                // Arrange
                const createInput = getCreateInput()
                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                    size: 1024000,
                    lastModified: new Date(),
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    createInput,
                    mockUserContext,
                )

                // Assert
                expect(authService.requireAuthentication).toHaveBeenCalled()
                expect(categoryRepository.findById).toHaveBeenCalledWith(
                    "category-123",
                )
                expect(
                    spacesUploadService.validateUploadedFile,
                ).toHaveBeenCalled()
                expect(phaseService.validatePhaseDates).toHaveBeenCalled()
                expect(repository.create).toHaveBeenCalled()
                expect(cacheService.setCampaign).toHaveBeenCalledWith(
                    mockCampaign.id,
                    mockCampaign,
                )
                expect(cacheService.invalidateAll).toHaveBeenCalled()
                expect(result).toEqual(mockCampaign)
                expect(result.donationCount).toBe(0)
                expect(result.extensionCount).toBe(0)
                expect(result.extensionDays).toBe(0)
            })

            it("should create campaign without category", async () => {
                // Arrange
                const createInput = getCreateInput()
                const inputWithoutCategory = {
                    ...createInput,
                    categoryId: undefined,
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    inputWithoutCategory,
                    mockUserContext,
                )

                // Assert
                expect(categoryRepository.findById).not.toHaveBeenCalled()
                expect(result).toEqual(mockCampaign)
            })

            it("should create campaign with phases successfully", async () => {
                // Arrange
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                const nextMonth = new Date(tomorrow)
                nextMonth.setMonth(nextMonth.getMonth() + 1)

                const phaseDate1 = new Date(nextMonth)
                phaseDate1.setDate(phaseDate1.getDate() + 1)
                const phaseDate2 = new Date(phaseDate1)
                phaseDate2.setDate(phaseDate2.getDate() + 1)
                const phaseDate3 = new Date(phaseDate2)
                phaseDate3.setDate(phaseDate3.getDate() + 1)

                const createInput = {
                    ...getCreateInput(),
                    phases: [
                        {
                            phaseName: "Phase 1 - North District",
                            location: "District 1, HCMC",
                            ingredientPurchaseDate: phaseDate1,
                            cookingDate: phaseDate2,
                            deliveryDate: phaseDate3,
                        },
                    ],
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    createInput,
                    mockUserContext,
                )

                // Assert
                expect(phaseService.validatePhaseDates).toHaveBeenCalledWith(
                    createInput.phases,
                    expect.any(Date), // ✅ Don't assert exact date due to timezone differences
                )
                expect(result).toEqual(mockCampaign)
            })
        })

        describe("Boundary values", () => {
            it("should accept campaign with start date = today", async () => {
                // Arrange
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)

                const inputWithTodayStart = {
                    ...getCreateInput(),
                    fundraisingStartDate: today,
                    fundraisingEndDate: tomorrow,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    inputWithTodayStart,
                    mockUserContext,
                )

                // Assert
                expect(result).toEqual(mockCampaign)
            })

            it("should accept campaign with minimum duration (1 day)", async () => {
                // Arrange
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                const dayAfter = new Date(tomorrow)
                dayAfter.setDate(dayAfter.getDate() + 1)

                const inputMinDuration = {
                    ...getCreateInput(),
                    fundraisingStartDate: tomorrow,
                    fundraisingEndDate: dayAfter,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    inputMinDuration,
                    mockUserContext,
                )

                // Assert
                expect(result).toEqual(mockCampaign)
            })

            it("should accept budget percentages that sum to exactly 100", async () => {
                // Arrange
                const inputExact100 = {
                    ...getCreateInput(),
                    ingredientBudgetPercentage: "50.00",
                    cookingBudgetPercentage: "30.00",
                    deliveryBudgetPercentage: "20.00",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    inputExact100,
                    mockUserContext,
                )

                // Assert
                expect(result).toEqual(mockCampaign)
            })

            it("should accept target amount = 1 (minimum)", async () => {
                // Arrange
                const inputMinAmount = {
                    ...getCreateInput(),
                    targetAmount: "1",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockReturnValue(undefined)
                repository.create.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.createCampaign(
                    inputMinAmount,
                    mockUserContext,
                )

                // Assert
                expect(result).toEqual(mockCampaign)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw error when user not authenticated", async () => {
                // Arrange
                const createInput = getCreateInput()
                authService.requireAuthentication.mockImplementation(() => {
                    throw new ForbiddenException("Authentication required")
                })

                // Act & Assert
                await expect(
                    service.createCampaign(createInput, mockUserContext),
                ).rejects.toThrow(ForbiddenException)
            })

            it("should throw error when category not found", async () => {
                // Arrange
                const createInput = getCreateInput()
                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(null)

                // Act & Assert
                await expect(
                    service.createCampaign(createInput, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Campaign category with ID category-123 not found",
                    ),
                )
            })

            it("should throw error when cover image file not found", async () => {
                // Arrange
                const createInput = getCreateInput()
                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: false,
                })

                // Act & Assert
                await expect(
                    service.createCampaign(createInput, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Cover image file not found. Please upload the file first using generateUploadUrl.",
                    ),
                )
            })

            it("should throw error when file key invalid", async () => {
                // Arrange
                const inputInvalidKey = {
                    ...getCreateInput(),
                    coverImageFileKey: "invalid/path/image.jpg",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "invalid/path/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputInvalidKey, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Invalid file key. Please use a valid file key from generateCampaignImageUploadUrl.",
                    ),
                )
            })

            it("should throw error when start date in past", async () => {
                // Arrange
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)

                const inputPastStart = {
                    ...getCreateInput(),
                    fundraisingStartDate: yesterday,
                    fundraisingEndDate: tomorrow,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputPastStart, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Start date cannot be in the past. Please select today or a future date.",
                    ),
                )
            })

            it("should throw error when end date <= start date", async () => {
                // Arrange
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)

                const inputInvalidDates = {
                    ...getCreateInput(),
                    fundraisingStartDate: tomorrow,
                    fundraisingEndDate: tomorrow,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputInvalidDates, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "End date must be after the start date. Please ensure there's at least one day between start and end dates.",
                    ),
                )
            })

            it("should throw error when target amount = 0", async () => {
                // Arrange
                const inputZeroAmount = {
                    ...getCreateInput(),
                    targetAmount: "0",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputZeroAmount, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Target amount must be greater than 0",
                    ),
                )
            })

            it("should throw error when target amount is negative", async () => {
                // Arrange
                const inputNegativeAmount = {
                    ...getCreateInput(),
                    targetAmount: "-1000",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(
                        inputNegativeAmount,
                        mockUserContext,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Target amount must be greater than 0",
                    ),
                )
            })

            it("should throw error when budget percentages sum to 99.99", async () => {
                // Arrange
                const inputUnder100 = {
                    ...getCreateInput(),
                    ingredientBudgetPercentage: "60.00",
                    cookingBudgetPercentage: "30.00",
                    deliveryBudgetPercentage: "9.99",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputUnder100, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Budget percentages must sum to 100%. Current total: 99.99%",
                    ),
                )
            })

            it("should throw error when budget percentage is negative", async () => {
                // Arrange
                const inputNegativeBudget = {
                    ...getCreateInput(),
                    ingredientBudgetPercentage: "-10.00",
                    cookingBudgetPercentage: "60.00",
                    deliveryBudgetPercentage: "50.00",
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                // ✅ Add mock for extractFileKeyFromUrl
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(
                        inputNegativeBudget,
                        mockUserContext,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Budget percentages must be between 0 and 100",
                    ),
                )
            })

            it("should throw error when phases have invalid dates", async () => {
                // Arrange
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                const nextMonth = new Date(tomorrow)
                nextMonth.setMonth(nextMonth.getMonth() + 1)

                const createInput = {
                    ...getCreateInput(),
                    phases: [
                        {
                            phaseName: "Phase 1",
                            location: "HCMC",
                            ingredientPurchaseDate: tomorrow,
                            cookingDate: tomorrow,
                            deliveryDate: tomorrow,
                        },
                    ],
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )
                phaseService.validatePhaseDates.mockImplementation(() => {
                    throw new BadRequestException(
                        "Phase dates must be after fundraising end date",
                    )
                })

                // Act & Assert
                await expect(
                    service.createCampaign(createInput, mockUserContext),
                ).rejects.toThrow(BadRequestException)
            })

            // ✅ NEW TEST: Test empty phases array
            it("should throw error when phases array is empty", async () => {
                // Arrange
                const inputNoPhases = {
                    ...getCreateInput(),
                    phases: [],
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                categoryRepository.findById.mockResolvedValue(mockCategory)
                spacesUploadService.validateUploadedFile.mockResolvedValue({
                    exists: true,
                    contentType: "image/jpeg",
                })
                spacesUploadService.extractFileKeyFromUrl.mockReturnValue(
                    "campaigns/user-123/image.jpg",
                )

                // Act & Assert
                await expect(
                    service.createCampaign(inputNoPhases, mockUserContext),
                ).rejects.toThrow(
                    new BadRequestException(
                        "At least one campaign phase is required",
                    ),
                )
            })
        })
    })

    // ==================== GET CAMPAIGNS ====================

    describe("getCampaigns", () => {
        const mockCampaigns = [mockCampaign]

        describe("Normal values (Happy path)", () => {
            it("should return campaigns from cache when available", async () => {
                // Arrange
                cacheService.getCampaignList.mockResolvedValue(mockCampaigns)

                // Act
                const result = await service.getCampaigns()

                // Assert
                expect(cacheService.getCampaignList).toHaveBeenCalled()
                expect(repository.findMany).not.toHaveBeenCalled()
                expect(result).toEqual(mockCampaigns)
            })

            it("should fetch from database when cache miss", async () => {
                // Arrange
                cacheService.getCampaignList.mockResolvedValue(null)
                repository.findMany.mockResolvedValue(mockCampaigns as any)
                cacheService.setCampaignList.mockResolvedValue(undefined)

                // Act
                const result = await service.getCampaigns()

                // Assert
                expect(repository.findMany).toHaveBeenCalled()
                expect(cacheService.setCampaignList).toHaveBeenCalledWith(
                    expect.any(Object),
                    mockCampaigns,
                )
                expect(result).toEqual(mockCampaigns)
            })
        })

        describe("Boundary values", () => {
            it("should return empty array when no campaigns exist", async () => {
                // Arrange
                cacheService.getCampaignList.mockResolvedValue(null)
                repository.findMany.mockResolvedValue([])
                cacheService.setCampaignList.mockResolvedValue(undefined)

                // Act
                const result = await service.getCampaigns()

                // Assert
                expect(result).toEqual([])
            })

            it("should handle limit = 100 (maximum)", async () => {
                // Arrange
                const campaigns100 = Array(100).fill(mockCampaign)
                cacheService.getCampaignList.mockResolvedValue(null)
                repository.findMany.mockResolvedValue(campaigns100)
                cacheService.setCampaignList.mockResolvedValue(undefined)

                // Act
                const result = await service.getCampaigns(
                    undefined,
                    undefined,
                    undefined,
                    100,
                )

                // Assert
                expect(result).toHaveLength(100)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should capture error when repository fails", async () => {
                // Arrange
                cacheService.getCampaignList.mockResolvedValue(null)
                const dbError = new Error("Database connection failed")
                repository.findMany.mockRejectedValue(dbError)

                // Act & Assert
                await expect(service.getCampaigns()).rejects.toThrow(dbError)
                expect(sentryService.captureError).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        operation: "getCampaigns",
                    }),
                )
            })
        })
    })

    // ==================== FIND CAMPAIGN BY ID ====================

    describe("findCampaignById", () => {
        describe("Normal values (Happy path)", () => {
            it("should return campaign from cache when available", async () => {
                // Arrange
                cacheService.getCampaign.mockResolvedValue(mockCampaign)

                // Act
                const result = await service.findCampaignById("campaign-123")

                // Assert
                expect(cacheService.getCampaign).toHaveBeenCalledWith(
                    "campaign-123",
                )
                expect(repository.findById).not.toHaveBeenCalled()
                expect(result).toEqual(mockCampaign)
            })

            it("should fetch from database when cache miss", async () => {
                // Arrange
                cacheService.getCampaign.mockResolvedValue(null)
                repository.findById.mockResolvedValue(mockCampaign as any)
                cacheService.setCampaign.mockResolvedValue(undefined)

                // Act
                const result = await service.findCampaignById("campaign-123")

                // Assert
                expect(repository.findById).toHaveBeenCalledWith("campaign-123")
                expect(cacheService.setCampaign).toHaveBeenCalledWith(
                    "campaign-123",
                    mockCampaign,
                )
                expect(result).toEqual(mockCampaign)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw CampaignNotFoundException when not found", async () => {
                // Arrange
                cacheService.getCampaign.mockResolvedValue(null)
                repository.findById.mockResolvedValue(null)

                // Act & Assert
                await expect(
                    service.findCampaignById("non-existent"),
                ).rejects.toThrow(CampaignNotFoundException)
            })
        })
    })

    // ==================== DELETE CAMPAIGN ====================

    describe("deleteCampaign", () => {
        describe("Normal values (Happy path)", () => {
            it("should delete campaign with PENDING status", async () => {
                // Arrange
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(mockCampaign)
                authService.requireOwnership.mockReturnValue(undefined)
                repository.delete.mockResolvedValue(true)
                cacheService.deleteCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)
                spacesUploadService.deleteResourceImage.mockResolvedValue(
                    undefined,
                )

                // Act
                const result = await service.deleteCampaign(
                    "campaign-123",
                    mockUserContext,
                )

                // Assert
                expect(repository.delete).toHaveBeenCalledWith("campaign-123")
                expect(cacheService.deleteCampaign).toHaveBeenCalledWith(
                    "campaign-123",
                )
                expect(result).toBe(true)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw error when campaign status is ACTIVE", async () => {
                // Arrange
                const activeCampaign = {
                    ...mockCampaign,
                    status: CampaignStatus.ACTIVE,
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(activeCampaign)
                authService.requireOwnership.mockReturnValue(undefined)

                // Act & Assert
                await expect(
                    service.deleteCampaign("campaign-123", mockUserContext),
                ).rejects.toThrow(CampaignCannotBeDeletedException)
            })

            it("should throw error when user not campaign owner", async () => {
                // Arrange
                const otherUserContext = {
                    ...mockUserContext,
                    userId: "other-user",
                }
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(mockCampaign)
                authService.requireOwnership.mockImplementation(() => {
                    throw new ForbiddenException("Not campaign owner")
                })

                // Act & Assert
                await expect(
                    service.deleteCampaign("campaign-123", otherUserContext),
                ).rejects.toThrow(ForbiddenException)
            })
        })
    })

    // ==================== EXTEND CAMPAIGN ====================

    describe("extendCampaign", () => {
        describe("Normal values (Happy path)", () => {
            it("should extend campaign successfully within 7 days of end date", async () => {
                // Arrange
                const now = new Date()
                const endDateIn5Days = new Date(now)
                endDateIn5Days.setDate(endDateIn5Days.getDate() + 5)

                const activeCampaign = {
                    ...mockCampaign,
                    status: CampaignStatus.ACTIVE,
                    fundraisingEndDate: endDateIn5Days,
                    extensionCount: 0,
                }

                const extendedCampaign = {
                    ...activeCampaign,
                    extensionCount: 1,
                    extensionDays: 14,
                    fundraisingEndDate: new Date(
                        endDateIn5Days.getTime() + 14 * 24 * 60 * 60 * 1000,
                    ),
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(activeCampaign)
                repository.update.mockResolvedValue(extendedCampaign as any)
                cacheService.deleteCampaign.mockResolvedValue(undefined)
                cacheService.invalidateAll.mockResolvedValue(undefined)

                // Act
                const result = await service.extendCampaign(
                    "campaign-123",
                    { extensionDays: 14 },
                    mockUserContext,
                )

                // Assert
                expect(repository.update).toHaveBeenCalledWith(
                    "campaign-123",
                    expect.objectContaining({
                        extensionCount: 1,
                        extensionDays: 14,
                    }),
                )
                expect(result.extensionCount).toBe(1)
                expect(result.extensionDays).toBe(14)
            })
        })

        describe("Abnormal values (Error cases)", () => {
            it("should throw error when campaign already extended", async () => {
                // Arrange
                const alreadyExtended = {
                    ...mockCampaign,
                    status: CampaignStatus.ACTIVE,
                    extensionCount: 1,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(alreadyExtended)

                // Act & Assert
                await expect(
                    service.extendCampaign(
                        "campaign-123",
                        { extensionDays: 14 },
                        mockUserContext,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Campaign can only be extended once",
                    ),
                )
            })

            it("should throw error when campaign not ACTIVE", async () => {
                // Arrange
                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(mockCampaign)

                // Act & Assert
                await expect(
                    service.extendCampaign(
                        "campaign-123",
                        { extensionDays: 14 },
                        mockUserContext,
                    ),
                ).rejects.toThrow(
                    new BadRequestException(
                        "Only ACTIVE campaigns can be extended. Current status: PENDING",
                    ),
                )
            })

            it("should throw error when more than 7 days until end date", async () => {
                // Arrange
                const now = new Date()
                const endDateIn10Days = new Date(now)
                endDateIn10Days.setDate(endDateIn10Days.getDate() + 10)

                const activeCampaign = {
                    ...mockCampaign,
                    status: CampaignStatus.ACTIVE,
                    fundraisingEndDate: endDateIn10Days,
                }

                authService.requireAuthentication.mockReturnValue(undefined)
                cacheService.getCampaign.mockResolvedValue(activeCampaign)

                // Act & Assert
                await expect(
                    service.extendCampaign(
                        "campaign-123",
                        { extensionDays: 14 },
                        mockUserContext,
                    ),
                ).rejects.toThrow(BadRequestException)
            })
        })
    })
})
