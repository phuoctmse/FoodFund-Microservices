import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import {
    ExpenseProofRepository,
    IngredientRequestItemRepository,
    IngredientRequestRepository,
    MealBatchRepository,
} from "../../repositories"
import { SpacesUploadService } from "@libs/s3-storage"
import {
    AuthorizationService,
    Role,
    UserContext,
} from "@app/operation/src/shared"
import { SentryService } from "@libs/observability"
import { GrpcClientService } from "@libs/grpc"
import {
    CreateMealBatchInput,
    GenerateMealBatchMediaUploadUrlsInput,
    MealBatchFilterInput,
    UpdateMealBatchStatusInput,
} from "../../dtos"
import { MealBatchMediaUploadResponse } from "../../dtos/meal-batch/response"
import { MealBatch } from "@app/operation/src/domain/entities"
import { MealBatchStatus } from "@app/operation/src/domain/enums"
import { MealBatchCacheService } from "./meal-batch-cache.service"

@Injectable()
export class MealBatchService {
    constructor(
        private readonly mealBatchRepository: MealBatchRepository,
        private readonly ingredientRequestRepository: IngredientRequestRepository,
        private readonly ingredientRequestItemRepository: IngredientRequestItemRepository,
        private readonly expenseProofRepository: ExpenseProofRepository,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly authorizationService: AuthorizationService,
        private readonly sentryService: SentryService,
        private readonly grpcClient: GrpcClientService,
        private readonly cacheService: MealBatchCacheService,
    ) {}

    async generateMediaUploadUrls(
        input: GenerateMealBatchMediaUploadUrlsInput,
        userContext: UserContext,
    ): Promise<MealBatchMediaUploadResponse> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "generate meal batch media upload URLs",
        )

        try {
            if (input.fileCount !== input.fileTypes.length) {
                throw new BadRequestException(
                    "File count must match number of file types provided",
                )
            }

            const allowedTypes = ["jpg", "jpeg", "png", "mp4", "mov"]
            const invalidTypes = input.fileTypes.filter(
                (type) => !allowedTypes.includes(type.toLowerCase()),
            )

            if (invalidTypes.length > 0) {
                throw new BadRequestException(
                    `Invalid file types: ${invalidTypes.join(", ")}. Allowed: ${allowedTypes.join(", ")}`,
                )
            }

            const uploadResults =
                await this.spacesUploadService.generateBatchImageUploadUrls(
                    userContext.userId,
                    "meal-batches",
                    input.fileCount,
                    input.fileTypes,
                    input.campaignPhaseId,
                )

            return {
                success: true,
                message: `Generated ${input.fileCount} upload URL(s) for meal batch media`,
                uploadUrls: uploadResults.map((result) => ({
                    uploadUrl: result.uploadUrl,
                    fileKey: result.fileKey,
                    cdnUrl: result.cdnUrl,
                    expiresAt: result.expiresAt,
                    fileType: result.fileType || "image",
                })),
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "generateMediaUploadUrls",
                userId: userContext.userId,
                input,
            })
            throw error
        }
    }

    async createMealBatch(
        input: CreateMealBatchInput,
        userContext: UserContext,
    ): Promise<MealBatch> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "create meal batch",
        )

        try {
            const ingredientItems =
                await this.ingredientRequestItemRepository.findByIds(
                    input.ingredientIds,
                )

            if (ingredientItems.length !== input.ingredientIds.length) {
                throw new BadRequestException("Some ingredient items not found")
            }

            const requestIds = [
                ...new Set(ingredientItems.map((item) => item.requestId)),
            ]

            const requests = await Promise.all(
                requestIds.map((id) =>
                    this.ingredientRequestRepository.findById(id),
                ),
            )

            const validRequests = requests.filter(
                (r): r is NonNullable<typeof r> => r !== null,
            )

            if (validRequests.length !== requestIds.length) {
                throw new BadRequestException(
                    "Some ingredient requests not found",
                )
            }

            const campaignPhaseIds = [
                ...new Set(validRequests.map((r) => r.campaignPhaseId)),
            ]

            if (campaignPhaseIds.length > 1) {
                throw new BadRequestException(
                    "All ingredients must belong to the same campaign phase",
                )
            }

            if (campaignPhaseIds[0] !== input.campaignPhaseId) {
                throw new BadRequestException(
                    "Ingredients do not belong to the specified campaign phase",
                )
            }

            for (const requestId of requestIds) {
                const expenseProofs =
                    await this.expenseProofRepository.findByRequestId(requestId)

                const hasApprovedProof = expenseProofs.some(
                    (proof) => proof.status === "APPROVED",
                )

                if (!hasApprovedProof) {
                    throw new BadRequestException(
                        `Ingredient request ${requestId} does not have an APPROVED expense proof. Cannot create meal batch.`,
                    )
                }
            }

            const validation = await this.spacesUploadService.validateFileKeys(
                input.mediaFileKeys,
                userContext.userId,
                "meal-batches",
            )

            if (!validation.valid) {
                throw new BadRequestException(
                    `Invalid file keys: ${validation.invalidKeys.join(", ")}`,
                )
            }

            const cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!
            const mediaUrls = input.mediaFileKeys.map(
                (key) => `${cdnEndpoint}/${key}`,
            )

            const mealBatch = await this.mealBatchRepository.create({
                campaignPhaseId: input.campaignPhaseId,
                kitchenStaffId: userContext.userId,
                plannedMealId: input.plannedMealId,
                foodName: input.foodName,
                quantity: input.quantity,
                media: mediaUrls,
                status: MealBatchStatus.PREPARING,
                ingredientIds: input.ingredientIds,
            })

            await Promise.all([
                this.cacheService.setBatch(mealBatch.id, mealBatch),
                this.cacheService.deletePhaseBatches(input.campaignPhaseId),
                this.cacheService.deleteUserBatches(userContext.userId),
                this.cacheService.deleteAllBatchLists(),
                this.cacheService.deleteAllCampaignBatches(),
            ])

            return mealBatch
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createMealBatch",
                userId: userContext.userId,
                input,
            })
            throw error
        }
    }

    async updateMealBatchStatus(
        id: string,
        input: UpdateMealBatchStatusInput,
        userContext: UserContext,
    ): Promise<MealBatch> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "update meal batch status",
        )

        try {
            const mealBatch = await this.mealBatchRepository.findById(id)

            if (!mealBatch) {
                throw new NotFoundException(`Meal batch not found: ${id}`)
            }

            if (mealBatch.kitchenStaffId !== userContext.userId) {
                throw new ForbiddenException(
                    "You can only update status of meal batches you created",
                )
            }

            if (mealBatch.status === MealBatchStatus.READY) {
                throw new BadRequestException(
                    "Cannot change status of a READY meal batch",
                )
            }

            if (mealBatch.status === MealBatchStatus.DELIVERED) {
                throw new BadRequestException(
                    "Cannot change status of a DELIVERED meal batch",
                )
            }

            if (
                mealBatch.status === MealBatchStatus.PREPARING &&
                input.status !== MealBatchStatus.READY
            ) {
                throw new BadRequestException(
                    "Can only change PREPARING status to READY",
                )
            }

            const cookedDate = input.status === MealBatchStatus.READY ? new Date() : undefined

            const updatedBatch = await this.mealBatchRepository.updateStatus(
                id,
                input.status,
                cookedDate,
            )

            await Promise.all([
                this.cacheService.deleteBatch(id),
                this.cacheService.deletePhaseBatches(mealBatch.campaignPhaseId),
                this.cacheService.deleteUserBatches(mealBatch.kitchenStaffId),
                this.cacheService.deleteAllBatchLists(),
                this.cacheService.deleteAllCampaignBatches(),
            ])

            await this.cacheService.setBatch(id, updatedBatch)

            return updatedBatch
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateMealBatchStatus",
                userId: userContext.userId,
                mealBatchId: id,
                input,
            })
            throw error
        }
    }

    async getMealBatchById(id: string): Promise<MealBatch> {
        try {
            let mealBatch = await this.cacheService.getBatch(id)

            if (!mealBatch) {
                const dbBatch = await this.mealBatchRepository.findById(id)

                if (!dbBatch) {
                    throw new NotFoundException(`Meal batch not found: ${id}`)
                }

                mealBatch = dbBatch

                await this.cacheService.setBatch(id, mealBatch)
            }

            return mealBatch
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getMealBatchById",
                mealBatchId: id,
            })
            throw error
        }
    }

    async getMealBatches(filter: MealBatchFilterInput): Promise<MealBatch[]> {
        try {
            let cachedBatches: MealBatch[] | null = null

            if (filter.campaignPhaseId) {
                cachedBatches = await this.cacheService.getPhaseBatches(
                    filter.campaignPhaseId,
                )
            } else if (filter.kitchenStaffId) {
                cachedBatches = await this.cacheService.getUserBatches(
                    filter.kitchenStaffId,
                )
            } else if (filter.campaignId) {
                cachedBatches = await this.cacheService.getCampaignBatches(
                    filter.campaignId,
                )
            } else {
                cachedBatches = await this.cacheService.getBatchList({ filter })
            }

            if (cachedBatches) {
                return cachedBatches
            }

            let batches: MealBatch[]

            if (filter.campaignId) {
                const phaseIds = await this.getCampaignPhaseIds(
                    filter.campaignId,
                )

                if (phaseIds.length === 0) {
                    return []
                }

                batches = await this.mealBatchRepository.findWithFilters({
                    campaignPhaseIds: phaseIds,
                    kitchenStaffId: filter.kitchenStaffId,
                    status: filter.status,
                })

                batches = batches.sort(
                    (a, b) => b.created_at.getTime() - a.created_at.getTime(),
                )

                await this.cacheService.setCampaignBatches(
                    filter.campaignId,
                    batches,
                )
            } else {
                batches = await this.mealBatchRepository.findWithFilters(filter)

                if (filter.campaignPhaseId) {
                    await this.cacheService.setPhaseBatches(
                        filter.campaignPhaseId,
                        batches,
                    )
                } else if (filter.kitchenStaffId) {
                    await this.cacheService.setUserBatches(
                        filter.kitchenStaffId,
                        batches,
                    )
                } else {
                    await this.cacheService.setBatchList({ filter }, batches)
                }
            }

            return batches
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getMealBatches",
                filter,
            })
            throw error
        }
    }

    private async getCampaignPhaseIds(campaignId: string): Promise<string[]> {
        const response = await this.grpcClient.callCampaignService<
            { campaignId: string },
            {
                success: boolean
                phases?: Array<{
                    id: string
                    campaignId: string
                    phaseName: string
                    location: string
                    ingredientPurchaseDate: string
                    cookingDate: string
                    deliveryDate: string
                }>
                error?: string
            }
        >("GetCampaignPhases", { campaignId }, { timeout: 10000, retries: 2 })

        if (!response.success || !response.phases) {
            return []
        }

        return response.phases.map((phase) => phase.id)
    }
}
