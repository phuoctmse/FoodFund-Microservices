import {
    OperationExpenseType,
    OperationRequest,
    OperationRequestStatus,
} from "@app/operation/src/domain"
import {
    AuthorizationService,
    Role,
    UserContext,
} from "@app/operation/src/shared"
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import {
    CreateOperationRequestInput,
    OperationRequestFilterInput,
    OperationRequestStatsResponse,
    UpdateOperationRequestStatusInput,
} from "../../dtos"
import {
    CreateOperationRequestData,
    OperationRequestRepository,
    UpdateStatusData,
} from "../../repositories"
import { SentryService } from "@libs/observability"
import { GrpcClientService } from "@libs/grpc"
import { OperationRequestCacheService } from "./operation-request-cache.service"
import { BaseOperationService } from "@app/operation/src/shared/services"

@Injectable()
export class OperationRequestService extends BaseOperationService {
    constructor(
        private readonly repository: OperationRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly cacheService: OperationRequestCacheService,
        sentryService: SentryService,
        grpcClient: GrpcClientService,
    ) {
        super(sentryService, grpcClient)
    }

    async createRequest(
        input: CreateOperationRequestInput,
        userContext: UserContext,
    ): Promise<OperationRequest> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "create operation request",
            )

            this.validateRoleForExpenseType(
                userContext.role!,
                input.expenseType,
            )

            await this.verifyCampaignPhaseExists(input.campaignPhaseId)

            const hasActive = await this.repository.hasActiveRequest(
                userContext.userId,
                input.campaignPhaseId,
                input.expenseType,
            )

            if (hasActive) {
                throw new BadRequestException(
                    `You already have a PENDING or APPROVED ${input.expenseType} request for this campaign phase. ` +
                        "You can only create a new request after the current one is REJECTED.",
                )
            }

            const totalCostBigInt = this.parseTotalCost(input.totalCost)

            const budgetType = this.getBudgetTypeForExpenseType(
                input.expenseType,
            )

            await this.validateBudget(
                input.campaignPhaseId,
                totalCostBigInt,
                budgetType,
            )

            const createData: CreateOperationRequestData = {
                campaignPhaseId: input.campaignPhaseId,
                userId: userContext.userId,
                title: input.title.trim(),
                totalCost: totalCostBigInt,
                expenseType: input.expenseType,
            }

            const created = await this.repository.create(createData)

            const newStatus = this.getPhaseStatusForRequestType(
                input.expenseType,
            )

            await this.updateCampaignPhaseStatus(
                input.campaignPhaseId,
                newStatus,
            )

            const mappedRequest = this.mapToGraphQLModel(created)

            const campaignId = await this.getCampaignIdFromPhaseId(
                input.campaignPhaseId,
            )

            await Promise.all([
                this.cacheService.setRequest(mappedRequest.id, mappedRequest),
                this.cacheService.deletePhaseRequests(input.campaignPhaseId),
                this.cacheService.deleteUserRequests(userContext.userId),
                this.cacheService.deleteAllRequestLists(),
                this.cacheService.deleteRequestStats(),
                campaignId
                    ? this.invalidateCampaignCache(campaignId)
                    : Promise.resolve(),
            ])

            return mappedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "OperationRequestService.createRequest",
                input,
                userId: userContext.userId,
            })
            throw error
        }
    }

    async updateRequestStatus(
        input: UpdateOperationRequestStatusInput,
        userContext: UserContext,
    ): Promise<OperationRequest> {
        try {
            this.authService.requireAdmin(
                userContext,
                "update operation request status",
            )

            const request = await this.repository.findById(input.requestId)

            if (!request) {
                throw new NotFoundException(
                    `Operation request with ID ${input.requestId} not found`,
                )
            }

            this.validateStatusTransition(
                request.status as OperationRequestStatus,
                input.status,
            )

            if (
                input.status === OperationRequestStatus.REJECTED &&
                !input.adminNote?.trim()
            ) {
                throw new BadRequestException(
                    "Admin note is required when rejecting a request",
                )
            }

            const updateData: UpdateStatusData = {
                status: input.status,
                adminNote: input.adminNote?.trim(),
                changedStatusAt: new Date(),
            }

            const updated = await this.repository.updateStatus(
                input.requestId,
                updateData,
            )

            const mappedRequest = this.mapToGraphQLModel(updated)

            await Promise.all([
                this.cacheService.setRequest(mappedRequest.id, mappedRequest),
                this.cacheService.deletePhaseRequests(
                    request.campaign_phase_id,
                ),
                this.cacheService.deleteUserRequests(request.user_id),
                this.cacheService.deleteAllRequestLists(),
                this.cacheService.deleteRequestStats(),
            ])

            return mappedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "OperationRequestService.updateRequestStatus",
                input,
                adminId: userContext.userId,
            })
            throw error
        }
    }

    async getRequests(
        filter: OperationRequestFilterInput,
    ): Promise<OperationRequest[]> {
        try {
            let cachedRequests: OperationRequest[] | null = null

            if (filter.campaignPhaseId) {
                cachedRequests = await this.cacheService.getPhaseRequests(
                    filter.campaignPhaseId,
                )
            } else if (filter.campaignId) {
                cachedRequests = await this.cacheService.getCampaignRequests(
                    filter.campaignId,
                )
            } else {
                cachedRequests = await this.cacheService.getRequestList({
                    filter,
                })
            }

            if (cachedRequests) {
                return cachedRequests
            }

            let requests: any[]

            if (filter.campaignId) {
                const phases = await this.getCampaignPhases(filter.campaignId)
                const phaseIds = phases.map((p) => p.id)

                if (phaseIds.length === 0) {
                    return []
                }

                requests = await this.repository.findByPhaseIds(
                    phaseIds,
                    filter.limit,
                    filter.offset,
                )

                const mappedRequests = requests.map((r) =>
                    this.mapToGraphQLModel(r),
                )

                await this.cacheService.setCampaignRequests(
                    filter.campaignId,
                    mappedRequests,
                )

                return mappedRequests
            }

            requests = await this.repository.findMany(filter)
            const mappedRequests = requests.map((r) =>
                this.mapToGraphQLModel(r),
            )

            if (filter.campaignPhaseId) {
                await this.cacheService.setPhaseRequests(
                    filter.campaignPhaseId,
                    mappedRequests,
                )
            } else {
                await this.cacheService.setRequestList(
                    { filter },
                    mappedRequests,
                )
            }

            return mappedRequests
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "OperationRequestService.getRequests",
                filter,
            })
            throw error
        }
    }

    async getRequestById(id: string): Promise<OperationRequest> {
        try {
            let request = await this.cacheService.getRequest(id)

            if (!request) {
                const dbRequest = await this.repository.findById(id)

                if (!dbRequest) {
                    throw new NotFoundException(
                        `Operation request with ID ${id} not found`,
                    )
                }

                request = this.mapToGraphQLModel(dbRequest)
                await this.cacheService.setRequest(id, request)
            }

            return request
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "OperationRequestService.getRequestById",
                requestId: id,
            })
            throw error
        }
    }

    async getMyRequests(
        userContext: UserContext,
        limit = 10,
        offset = 0,
    ): Promise<OperationRequest[]> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "view your operation requests",
            )

            const cachedRequests = await this.cacheService.getUserRequests(
                userContext.userId,
                limit,
                offset,
            )

            if (cachedRequests) {
                return cachedRequests
            }

            const requests = await this.repository.findByUserId(
                userContext.userId,
                limit,
                offset,
            )

            const mappedRequests = requests.map((r) =>
                this.mapToGraphQLModel(r),
            )

            await this.cacheService.setUserRequests(
                userContext.userId,
                limit,
                offset,
                mappedRequests,
            )

            return mappedRequests
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "OperationRequestService.getMyRequests",
                userId: userContext.userId,
            })
            throw error
        }
    }

    async getStats(
        userContext: UserContext,
    ): Promise<OperationRequestStatsResponse> {
        try {
            this.authService.requireAdmin(
                userContext,
                "view operation request statistics",
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
                operation: "OperationRequestService.getStats",
                adminId: userContext.userId,
            })
            throw error
        }
    }

    // ==================== Private Helper Methods ====================

    /**
     * Get campaign phase status based on expense type
     */
    private getPhaseStatusForRequestType(
        expenseType: OperationExpenseType,
    ): string {
        const statusMap: Record<OperationExpenseType, string> = {
            [OperationExpenseType.COOKING]: "AWAITING_COOKING_DISBURSEMENT",
            [OperationExpenseType.DELIVERY]: "AWAITING_DELIVERY_DISBURSEMENT",
        }

        return statusMap[expenseType]
    }

    /**
     * Get budget type field name based on expense type
     */
    private getBudgetTypeForExpenseType(
        expenseType: OperationExpenseType,
    ): "cookingFundsAmount" | "deliveryFundsAmount" {
        const budgetMap: Record<
            OperationExpenseType,
            "cookingFundsAmount" | "deliveryFundsAmount"
        > = {
            [OperationExpenseType.COOKING]: "cookingFundsAmount",
            [OperationExpenseType.DELIVERY]: "deliveryFundsAmount",
        }

        return budgetMap[expenseType]
    }

    /**
     * Validate user role for expense type
     */
    private validateRoleForExpenseType(
        role: Role,
        expenseType: OperationExpenseType,
    ): void {
        const allowedRoles: Record<OperationExpenseType, Role[]> = {
            [OperationExpenseType.COOKING]: [
                Role.KITCHEN_STAFF,
                Role.FUNDRAISER,
            ],
            [OperationExpenseType.DELIVERY]: [
                Role.DELIVERY_STAFF,
                Role.FUNDRAISER,
            ],
        }

        const allowed = allowedRoles[expenseType]

        if (!allowed.includes(role)) {
            throw new BadRequestException(
                `Only ${allowed.join(" or ")} can create ${expenseType} requests. Your role: ${role}`,
            )
        }
    }

    /**
     * Validate status transition
     */
    private validateStatusTransition(
        currentStatus: OperationRequestStatus,
        newStatus: OperationRequestStatus,
    ): void {
        const validTransitions: Record<
            OperationRequestStatus,
            OperationRequestStatus[]
        > = {
            [OperationRequestStatus.PENDING]: [
                OperationRequestStatus.APPROVED,
                OperationRequestStatus.REJECTED,
            ],
            [OperationRequestStatus.APPROVED]: [
                OperationRequestStatus.PENDING,
                OperationRequestStatus.DISBURSED,
            ],
            [OperationRequestStatus.REJECTED]: [],
            [OperationRequestStatus.DISBURSED]: [],
        }

        const allowed = validTransitions[currentStatus] || []

        if (!allowed.includes(newStatus)) {
            throw new BadRequestException(
                `Cannot transition from ${currentStatus} to ${newStatus}. ` +
                    `Allowed transitions: ${allowed.length > 0 ? allowed.join(", ") : "none"}`,
            )
        }
    }

    /**
     * Map database record to GraphQL model
     */
    private mapToGraphQLModel(data: any): OperationRequest {
        return {
            id: data.id,
            campaignPhaseId: data.campaign_phase_id,
            userId: data.user_id,
            title: data.title,
            totalCost: data.total_cost.toString(),
            expenseType: data.expense_type as OperationExpenseType,
            status: data.status as OperationRequestStatus,
            adminNote: data.admin_note,
            changedStatusAt: data.changed_status_at,
            created_at: data.created_at,
            updated_at: data.updated_at,
            user: {
                __typename: "User",
                id: data.user_id,
            },
            campaignPhase: {
                __typename: "CampaignPhase",
                id: data.campaign_phase_id,
            },
        }
    }
}