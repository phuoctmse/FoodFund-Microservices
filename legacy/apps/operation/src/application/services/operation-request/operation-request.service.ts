import {
    OperationExpenseType,
    OperationRequest,
    OperationRequestStatus,
} from "@app/operation/src/domain"
import {
    AuthorizationService,
    CampaignPhaseStatus,
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
import { OperationRequestSortOrder } from "@app/operation/src/domain/enums/operation-request"
import { EventEmitter2 } from "@nestjs/event-emitter"
import {
    CookingRequestApprovedEvent,
    CookingRequestRejectedEvent,
    DeliveryRequestApprovedEvent,
    DeliveryRequestRejectedEvent,
} from "@app/operation/src/domain/events"

@Injectable()
export class OperationRequestService extends BaseOperationService {
    constructor(
        private readonly repository: OperationRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly cacheService: OperationRequestCacheService,
        private readonly eventEmitter: EventEmitter2,
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

            const currentPhaseStatus = await this.getCampaignPhaseStatus(
                input.campaignPhaseId,
            )

            const requiredStatusMap: Record<
                OperationExpenseType,
                CampaignPhaseStatus
            > = {
                [OperationExpenseType.COOKING]:
                    CampaignPhaseStatus.INGREDIENT_PURCHASE,
                [OperationExpenseType.DELIVERY]: CampaignPhaseStatus.COOKING,
            }

            const requiredStatus = requiredStatusMap[input.expenseType]

            if (currentPhaseStatus !== requiredStatus) {
                throw new BadRequestException(
                    `Cannot create ${input.expenseType} request when phase is in ${currentPhaseStatus} status. ` +
                        `Phase must be in ${requiredStatus} to create ${input.expenseType} request.`,
                )
            }

            const hasActive = await this.repository.hasActiveRequest(
                userContext.userId,
                input.campaignPhaseId,
                input.expenseType,
            )

            if (hasActive) {
                throw new BadRequestException(
                    `Tổ chức của bạn đã tạo yêu cầu giải ngân ${input.expenseType} cho giai đoạn chiến dịch này rồi.`,
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

            const createData: CreateOperationRequestData = {
                campaignPhaseId: input.campaignPhaseId,
                userId: userContext.userId,
                organizationId: organizationId || "",
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

            const campaignPhaseDetails = await this.getCampaignPhaseDetails(
                request.campaign_phase_id,
            )

            if (input.status === OperationRequestStatus.APPROVED) {
                if (request.expense_type === OperationExpenseType.COOKING) {
                    this.eventEmitter.emit(
                        "operation-request.cooking.approved",
                        {
                            operationRequestId: input.requestId,
                            campaignId: campaignPhaseDetails.campaignId,
                            campaignPhaseId: request.campaign_phase_id,
                            campaignTitle: campaignPhaseDetails.campaignTitle,
                            phaseName: campaignPhaseDetails.phaseName,
                            fundraiserId: campaignPhaseDetails.fundraiserId,
                            organizationId: request.organization_id || null,
                            totalCost: request.total_cost.toString(),
                            approvedAt: new Date().toISOString(),
                        } satisfies CookingRequestApprovedEvent,
                    )
                } else if (
                    request.expense_type === OperationExpenseType.DELIVERY
                ) {
                    this.eventEmitter.emit(
                        "operation-request.delivery.approved",
                        {
                            operationRequestId: input.requestId,
                            campaignId: campaignPhaseDetails.campaignId,
                            campaignPhaseId: request.campaign_phase_id,
                            campaignTitle: campaignPhaseDetails.campaignTitle,
                            phaseName: campaignPhaseDetails.phaseName,
                            fundraiserId: campaignPhaseDetails.fundraiserId,
                            organizationId: request.organization_id || null,
                            totalCost: request.total_cost.toString(),
                            approvedAt: new Date().toISOString(),
                        } satisfies DeliveryRequestApprovedEvent,
                    )
                }
            } else if (input.status === OperationRequestStatus.REJECTED) {
                if (request.expense_type === OperationExpenseType.COOKING) {
                    this.eventEmitter.emit(
                        "operation-request.cooking.rejected",
                        {
                            operationRequestId: input.requestId,
                            campaignId: campaignPhaseDetails.campaignId,
                            campaignPhaseId: request.campaign_phase_id,
                            campaignTitle: campaignPhaseDetails.campaignTitle,
                            phaseName: campaignPhaseDetails.phaseName,
                            fundraiserId: campaignPhaseDetails.fundraiserId,
                            organizationId: request.organization_id || null,
                            totalCost: request.total_cost.toString(),
                            adminNote: input.adminNote || "No reason provided",
                            rejectedAt: new Date().toISOString(),
                        } satisfies CookingRequestRejectedEvent,
                    )
                } else if (
                    request.expense_type === OperationExpenseType.DELIVERY
                ) {
                    this.eventEmitter.emit(
                        "operation-request.delivery.rejected",
                        {
                            operationRequestId: input.requestId,
                            campaignId: campaignPhaseDetails.campaignId,
                            campaignPhaseId: request.campaign_phase_id,
                            campaignTitle: campaignPhaseDetails.campaignTitle,
                            phaseName: campaignPhaseDetails.phaseName,
                            fundraiserId: campaignPhaseDetails.fundraiserId,
                            organizationId: request.organization_id || null,
                            totalCost: request.total_cost.toString(),
                            adminNote: input.adminNote || "No reason provided",
                            rejectedAt: new Date().toISOString(),
                        } satisfies DeliveryRequestRejectedEvent,
                    )
                }
            }

            const mappedRequest = this.mapToGraphQLModel(updated)

            await Promise.all([
                this.cacheService.setRequest(mappedRequest.id, mappedRequest),
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
            const cacheKey = { filter }

            let cachedRequests: OperationRequest[] | null = null
            cachedRequests = await this.cacheService.getRequestList(cacheKey)

            if (cachedRequests) {
                return this.sortRequests(
                    cachedRequests,
                    filter.sortBy || OperationRequestSortOrder.NEWEST_FIRST,
                )
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
                    filter,
                )
            } else {
                requests = await this.repository.findMany(filter)
            }

            const mappedRequests = requests.map((r) =>
                this.mapToGraphQLModel(r),
            )

            const sortedRequests = this.sortRequests(
                mappedRequests,
                filter.sortBy || OperationRequestSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setRequestList(cacheKey, sortedRequests)

            return sortedRequests
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
        sortBy?: OperationRequestSortOrder,
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
                return this.sortRequests(
                    cachedRequests,
                    sortBy || OperationRequestSortOrder.NEWEST_FIRST,
                )
            }

            const requests = await this.repository.findByUserId(
                userContext.userId,
                limit,
                offset,
                sortBy,
            )

            const mappedRequests = requests.map((r) =>
                this.mapToGraphQLModel(r),
            )

            const sortedRequests = this.sortRequests(
                mappedRequests,
                sortBy || OperationRequestSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setUserRequests(
                userContext.userId,
                limit,
                offset,
                sortedRequests,
            )

            return sortedRequests
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

    private async getCampaignPhaseDetails(phaseId: string): Promise<{
        campaignId: string
        campaignTitle: string
        phaseName: string
        fundraiserId: string
    }> {
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
        >("GetCampaignPhaseInfo", { phaseId }, { timeout: 5000, retries: 2 })

        if (!response.success || !response.phase) {
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
    }

    private getPhaseStatusForRequestType(
        expenseType: OperationExpenseType,
    ): string {
        const statusMap: Record<OperationExpenseType, string> = {
            [OperationExpenseType.COOKING]: "AWAITING_COOKING_DISBURSEMENT",
            [OperationExpenseType.DELIVERY]: "AWAITING_DELIVERY_DISBURSEMENT",
        }

        return statusMap[expenseType]
    }

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

    private sortRequests(
        requests: OperationRequest[],
        sortBy: OperationRequestSortOrder,
    ): OperationRequest[] {
        const sorted = [...requests]

        switch (sortBy) {
        case OperationRequestSortOrder.OLDEST_FIRST:
            return sorted.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

        case OperationRequestSortOrder.STATUS_PENDING_FIRST: {
            const pendingRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.PENDING,
            )
            const approvedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.APPROVED,
            )
            const disbursedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.DISBURSED,
            )
            const rejectedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.REJECTED,
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

        case OperationRequestSortOrder.STATUS_APPROVED_FIRST: {
            const approvedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.APPROVED,
            )
            const pendingRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.PENDING,
            )
            const disbursedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.DISBURSED,
            )
            const rejectedRequests = sorted.filter(
                (r) => r.status === OperationRequestStatus.REJECTED,
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

        case OperationRequestSortOrder.NEWEST_FIRST:
        default:
            return sorted.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )
        }
    }

    private mapToGraphQLModel(data: any): OperationRequest {
        return {
            id: data.id,
            campaignPhaseId: data.campaign_phase_id,
            organizationId: data.organization_id || undefined,
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
            organization: {
                __typename: "Organization",
                id: data.organization_id,
            },
        }
    }
}
