import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { SentryService } from "@libs/observability"
import { IngredientRequestRepository } from "../../repositories"
import {
    AuthorizationService,
    Role,
    UserContext,
} from "@app/operation/src/shared"
import { IngredientRequest } from "@app/operation/src/domain"
import { IngredientRequestStatus } from "@app/operation/src/domain/enums"
import { GrpcClientService } from "@libs/grpc"
import { IngredientRequestCacheService } from "./ingredient-request-cache.service"
import { BaseOperationService } from "@app/operation/src/shared/services"
import { BudgetValidationHelper } from "@app/operation/src/shared/helpers"
import {
    CreateIngredientRequestInput,
    IngredientRequestFilterInput,
    UpdateIngredientRequestStatusInput,
} from "../../dtos/ingredient-request/request/ingredient-request.input"
import { CampaignPhaseStatus } from "@app/operation/src/shared/enums"

@Injectable()
export class IngredientRequestService extends BaseOperationService {
    constructor(
        private readonly repository: IngredientRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly cacheService: IngredientRequestCacheService,
        sentryService: SentryService,
        grpcClient: GrpcClientService,
    ) {
        super(sentryService, grpcClient)
    }

    async createRequest(
        input: CreateIngredientRequestInput,
        userContext: UserContext,
    ): Promise<IngredientRequest> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "create ingredient request",
            )

            if (
                userContext.role !== Role.KITCHEN_STAFF &&
                userContext.role !== Role.FUNDRAISER
            ) {
                throw new ForbiddenException(
                    "Only kitchen staff or fundraiser can create ingredient requests",
                )
            }

            if (!input.items || input.items.length === 0) {
                throw new BadRequestException(
                    "At least one ingredient item is required",
                )
            }

            const totalCostBigInt = this.parseTotalCost(input.totalCost)

            BudgetValidationHelper.validateItemPrices(input.items)
            BudgetValidationHelper.validateItemsTotalCost(
                input.items,
                input.totalCost,
            )

            const currentPhaseStatus = await this.getCampaignPhaseStatus(
                input.campaignPhaseId,
            )

            const allowedStatuses = [
                CampaignPhaseStatus.PLANNING,
                CampaignPhaseStatus.AWAITING_INGREDIENT_DISBURSEMENT,
            ]

            if (!allowedStatuses.includes(currentPhaseStatus)) {
                throw new BadRequestException(
                    `Cannot create ingredient request when phase is in ${currentPhaseStatus} status. ` +
                        "Phase must be in PLANNING or AWAITING_INGREDIENT_DISBURSEMENT.",
                )
            }

            const hasPending =
                await this.repository.hasActiveRequest(
                    input.campaignPhaseId,
                )
            if (hasPending) {
                throw new BadRequestException(
                    "Không thể tạo mới yêu cầu giải ngân vì đã có yêu cầu tồn tại trong giai đoạn chiến dịch này.",
                )
            }

            await this.validateBudget(
                input.campaignPhaseId,
                totalCostBigInt,
                "ingredientFundsAmount",
            )

            const userBasicInfo = await this.grpcClient.callUserService<
                { userId: string },
                {
                    success: boolean
                    user?: {
                        id: string
                        role: string
                        organizationId: string | null
                        organizationName: string | null
                    }
                    error?: string
                }
            >("GetUserBasicInfo", {
                userId: userContext.userId,
            })

            const organizationId = userBasicInfo.user?.organizationId || null

            const request = await this.repository.create(
                input,
                userContext.userId,
                organizationId || "",
            )

            if (currentPhaseStatus === CampaignPhaseStatus.PLANNING) {
                await this.updateCampaignPhaseStatus(
                    input.campaignPhaseId,
                    "AWAITING_INGREDIENT_DISBURSEMENT",
                )
            }

            const campaignId = await this.getCampaignIdFromPhaseId(
                input.campaignPhaseId,
            )

            await Promise.all([
                this.cacheService.setRequest(request.id, request),
                this.cacheService.deletePhaseRequests(input.campaignPhaseId),
                this.cacheService.deleteUserRequests(userContext.userId),
                this.cacheService.deleteAllRequestLists(),
                this.cacheService.deleteRequestStats(),
                campaignId
                    ? this.invalidateCampaignCache(campaignId)
                    : Promise.resolve(),
            ])

            return request
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.createRequest",
                userId: userContext.userId,
                campaignPhaseId: input.campaignPhaseId,
            })
            throw error
        }
    }

    async getRequestById(id: string): Promise<IngredientRequest> {
        try {
            let request = await this.cacheService.getRequest(id)

            if (!request) {
                const dbRequest = await this.repository.findById(id)

                if (!dbRequest) {
                    throw new NotFoundException(
                        `Ingredient request with ID ${id} not found`,
                    )
                }

                request = dbRequest
                await this.cacheService.setRequest(id, request)
            }

            return request
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.getRequestById",
                requestId: id,
            })
            throw error
        }
    }

    async getRequests(
        filter?: IngredientRequestFilterInput,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        try {
            const cacheKey = { filter, limit, offset }
            const cachedRequests =
                await this.cacheService.getRequestList(cacheKey)

            if (cachedRequests) {
                return cachedRequests
            }

            let requests: IngredientRequest[]

            if (filter?.campaignId && !filter?.campaignPhaseId) {
                const campaignPhases = await this.getCampaignPhases(
                    filter.campaignId,
                )

                if (campaignPhases.length === 0) {
                    return []
                }

                const phaseIds = campaignPhases.map((phase) => phase.id)

                requests = await this.repository.findByMultipleCampaignPhases(
                    phaseIds,
                    filter.status,
                    filter.sortBy,
                    limit,
                    offset,
                )
            } else {
                requests = await this.repository.findMany(filter, limit, offset)
            }

            await this.cacheService.setRequestList(cacheKey, requests)

            return requests
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.getRequests",
                filter,
            })
            throw error
        }
    }

    async getMyRequests(
        userContext: UserContext,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "get my ingredient requests",
            )

            const cachedRequests = await this.cacheService.getUserRequests(
                userContext.userId,
            )

            if (cachedRequests) {
                return cachedRequests
            }

            const requests = await this.repository.findByKitchenStaffId(
                userContext.userId,
                limit,
                offset,
            )

            await this.cacheService.setUserRequests(
                userContext.userId,
                requests,
            )

            return requests
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.getMyRequests",
                userId: userContext.userId,
            })
            throw error
        }
    }

    async getStats(userContext: UserContext): Promise<{
        totalRequests: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
        disbursedCount: number
    }> {
        try {
            this.authService.requireAdmin(
                userContext,
                "view ingredient request statistics",
            )

            const cachedStats = await this.cacheService.getRequestStats()

            if (cachedStats) {
                return cachedStats
            }

            const stats = await this.repository.getStats()

            await this.cacheService.setRequestStats(stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.getStats",
                adminId: userContext.userId,
            })
            throw error
        }
    }

    async updateRequestStatus(
        id: string,
        input: UpdateIngredientRequestStatusInput,
        userContext: UserContext,
    ): Promise<IngredientRequest> {
        try {
            this.authService.requireAdmin(
                userContext,
                "update ingredient request status",
            )

            const existingRequest = await this.repository.findById(id)
            if (!existingRequest) {
                throw new NotFoundException(
                    `Ingredient request with ID ${id} not found`,
                )
            }

            if (existingRequest.status !== IngredientRequestStatus.PENDING) {
                throw new BadRequestException(
                    `Cannot change status from ${existingRequest.status}. Only PENDING requests can be approved/rejected.`,
                )
            }

            const updatedRequest = await this.repository.updateStatus(
                id,
                input.status,
            )

            await Promise.all([
                this.cacheService.setRequest(id, updatedRequest),
                this.cacheService.deletePhaseRequests(
                    existingRequest.campaignPhaseId,
                ),
                this.cacheService.deleteUserRequests(
                    existingRequest.kitchenStaffId,
                ),
                this.cacheService.deleteAllRequestLists(),
                this.cacheService.deleteRequestStats(),
            ])

            return updatedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.updateRequestStatus",
                requestId: id,
                newStatus: input.status,
                adminId: userContext.userId,
            })
            throw error
        }
    }
}
