import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
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
import {
    IngredientRequestSortOrder,
    IngredientRequestStatus,
} from "@app/operation/src/domain/enums"
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
import { EventEmitter2 } from "@nestjs/event-emitter"

@Injectable()
export class IngredientRequestService extends BaseOperationService {
    private readonly logger = new Logger(IngredientRequestService.name)

    constructor(
        private readonly repository: IngredientRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly cacheService: IngredientRequestCacheService,
        private readonly eventEmitter: EventEmitter2,
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
                    `Không thể tạo yêu cầu giải ngân tiền nguyên liệu khi giai đoạn chiến dịch ở trạng thái ${currentPhaseStatus}. ` +
                        "Giai đoạn phải trong trạng thái PLANNING hoặc AWAITING_INGREDIENT_DISBURSEMENT.",
                )
            }

            const campaignId = await this.getCampaignIdFromPhaseId(
                input.campaignPhaseId,
            )

            if (!campaignId) {
                throw new NotFoundException(
                    `Chiến dịch không tìm thấy ${input.campaignPhaseId}`,
                )
            }

            const campaignStatus = await this.getCampaignStatus(campaignId)

            if (campaignStatus !== "PROCESSING") {
                throw new BadRequestException(
                    "Không thể tạo yêu cầu giải ngân tiền nguyên liệu. Chiến dịch phải trong trạng thái đang vận hành. " +
                        `Trạng thái hiện tại: ${campaignStatus}. `,
                )
            }

            const hasPending = await this.repository.hasActiveRequest(
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
                return this.sortRequests(
                    cachedRequests,
                    filter?.sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
                )
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

            const sortedRequests = this.sortRequests(
                requests,
                filter?.sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setRequestList(cacheKey, sortedRequests)

            return sortedRequests
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
        sortBy?: IngredientRequestSortOrder,
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
                return this.sortRequests(
                    cachedRequests,
                    sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
                )
            }

            const requests = await this.repository.findByKitchenStaffId(
                userContext.userId,
                limit,
                offset,
            )

            const sortedRequests = this.sortRequests(
                requests,
                sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setUserRequests(
                userContext.userId,
                sortedRequests,
            )

            return sortedRequests
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

            const campaignPhaseDetails = await this.getCampaignPhaseDetails(
                existingRequest.campaignPhaseId,
            )

            if (input.status === IngredientRequestStatus.APPROVED) {
                this.eventEmitter.emit("ingredient-request.approved", {
                    ingredientRequestId: id,
                    campaignId: campaignPhaseDetails.campaignId,
                    campaignPhaseId: existingRequest.campaignPhaseId,
                    campaignTitle: campaignPhaseDetails.campaignTitle,
                    phaseName: campaignPhaseDetails.phaseName,
                    fundraiserId: campaignPhaseDetails.fundraiserId,
                    organizationId: existingRequest.organizationId || null,
                    totalCost: existingRequest.totalCost.toString(),
                    itemCount: existingRequest.items?.length || 0,
                    approvedAt: new Date().toISOString(),
                })
            } else if (input.status === IngredientRequestStatus.REJECTED) {
                this.eventEmitter.emit("ingredient-request.rejected", {
                    ingredientRequestId: id,
                    campaignId: campaignPhaseDetails.campaignId,
                    campaignPhaseId: existingRequest.campaignPhaseId,
                    campaignTitle: campaignPhaseDetails.campaignTitle,
                    phaseName: campaignPhaseDetails.phaseName,
                    fundraiserId: campaignPhaseDetails.fundraiserId,
                    organizationId: existingRequest.organizationId || null,
                    totalCost: existingRequest.totalCost.toString(),
                    itemCount: existingRequest.items?.length || 0,
                    adminNote: input.adminNote || "No reason provided",
                    rejectedAt: new Date().toISOString(),
                })
            }

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

    private async getCampaignPhaseDetails(phaseId: string): Promise<{
        campaignId: string
        campaignTitle: string
        phaseName: string
        fundraiserId: string
    }> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    phase?: {
                        id: string
                        campaignId: string
                        campaignTitle: string
                        phaseName: string
                        fundraiserId: string
                    }
                    error?: string
                }
            >(
                "GetCampaignPhaseInfo",
                { phaseId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success || !response.phase) {
                this.logger.warn(
                    `Failed to get campaign phase details: ${response.error || "Phase not found"}`,
                )
                return {
                    campaignId: "unknown",
                    campaignTitle: "Chiến dịch",
                    phaseName: "Giai đoạn",
                    fundraiserId: "unknown",
                }
            }

            return {
                campaignId: response.phase.campaignId,
                campaignTitle: response.phase.campaignTitle,
                phaseName: response.phase.phaseName,
                fundraiserId: response.phase.fundraiserId,
            }
        } catch (error) {
            this.logger.warn(
                `Failed to get campaign phase details: ${error.message}`,
            )
            return {
                campaignId: "unknown",
                campaignTitle: "Chiến dịch",
                phaseName: "Giai đoạn",
                fundraiserId: "unknown",
            }
        }
    }

    private sortRequests(
        requests: IngredientRequest[],
        sortBy: IngredientRequestSortOrder,
    ): IngredientRequest[] {
        const sorted = [...requests]

        switch (sortBy) {
        case IngredientRequestSortOrder.OLDEST_FIRST:
            return sorted.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

        case IngredientRequestSortOrder.STATUS_PENDING_FIRST: {
            const pendingRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.PENDING,
            )
            const approvedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.APPROVED,
            )
            const disbursedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.DISBURSED,
            )
            const rejectedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.REJECTED,
            )

            pendingRequests.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

            approvedRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            disbursedRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            rejectedRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            return [
                ...pendingRequests,
                ...approvedRequests,
                ...disbursedRequests,
                ...rejectedRequests,
            ]
        }

        case IngredientRequestSortOrder.STATUS_APPROVED_FIRST: {
            const approvedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.APPROVED,
            )
            const pendingRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.PENDING,
            )
            const disbursedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.DISBURSED,
            )
            const rejectedRequests = sorted.filter(
                (r) => r.status === IngredientRequestStatus.REJECTED,
            )

            approvedRequests.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

            pendingRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            disbursedRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            rejectedRequests.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            return [
                ...approvedRequests,
                ...pendingRequests,
                ...disbursedRequests,
                ...rejectedRequests,
            ]
        }

        case IngredientRequestSortOrder.NEWEST_FIRST:
        default:
            return sorted.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )
        }
    }
}
