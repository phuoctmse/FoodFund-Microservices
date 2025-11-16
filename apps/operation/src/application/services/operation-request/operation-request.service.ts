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

@Injectable()
export class OperationRequestService {
    constructor(
        private readonly repository: OperationRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
        private readonly cacheService: OperationRequestCacheService,
    ) {}

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

            const campaignIdResponse =
                await this.grpcClient.callCampaignService<
                    { phaseId: string },
                    {
                        success: boolean
                        campaignId?: string
                        error?: string
                    }
                >(
                    "GetCampaignIdByPhaseId",
                    { phaseId: input.campaignPhaseId },
                    { timeout: 3000, retries: 1 },
                )

            const campaignId = campaignIdResponse.campaignId

            await Promise.all([
                this.cacheService.setRequest(mappedRequest.id, mappedRequest),
                this.cacheService.deletePhaseRequests(input.campaignPhaseId),
                this.cacheService.deleteUserRequests(userContext.userId),
                this.cacheService.deleteAllRequestLists(),
                this.cacheService.deleteStats(),
                campaignId
                    ? this.invalidateCampaignCache(campaignId)
                    : Promise.resolve(),
            ])

            return mappedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createOperationRequest",
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
                this.cacheService.deleteStats(),
            ])

            return mappedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateOperationRequestStatus",
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
                operation: "getOperationRequests",
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
                operation: "getOperationRequestById",
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
                operation: "getMyOperationRequests",
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

            const cachedStats = await this.cacheService.getStats()

            if (cachedStats) {
                return cachedStats
            }

            const stats = await this.repository.getStats()

            await this.cacheService.setStats(stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getOperationRequestStats",
                adminId: userContext.userId,
            })
            throw error
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

    private async updateCampaignPhaseStatus(
        phaseId: string,
        status: string,
    ): Promise<void> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string; status: string },
                { success: boolean; error: string | null }
            >(
                "UpdatePhaseStatus",
                { phaseId, status },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to update campaign phase status",
                )
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateCampaignPhaseStatus",
                phaseId,
                status,
            })
            throw error
        }
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

    private async verifyCampaignPhaseExists(phaseId: string): Promise<void> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    campaignId: string | null
                    error: string | null
                }
            >("GetCampaignIdByPhaseId", { phaseId })

            if (!response.success || !response.campaignId) {
                throw new BadRequestException(
                    response.error || `Campaign phase ${phaseId} not found`,
                )
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Failed to verify campaign phase. Please try again.",
            )
        }
    }

    private async getCampaignPhases(campaignId: string): Promise<any[]> {
        const response = await this.grpcClient.callCampaignService<
            { campaignId: string },
            { success: boolean; phases: any[]; error: string | null }
        >("GetCampaignPhases", { campaignId })

        if (!response.success) {
            throw new BadRequestException(
                response.error || "Failed to fetch campaign phases",
            )
        }

        return response.phases || []
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
            [OperationRequestStatus.APPROVED]: [OperationRequestStatus.PENDING],
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

    private parseTotalCost(totalCost: string): bigint {
        try {
            const cost = BigInt(totalCost)

            if (cost < 0n) {
                throw new BadRequestException("Total cost cannot be negative")
            }

            if (cost === 0n) {
                throw new BadRequestException(
                    "Total cost must be greater than 0",
                )
            }

            return cost
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            throw new BadRequestException(
                "Invalid total cost format. Must be a valid number.",
            )
        }
    }

    private async invalidateCampaignCache(campaignId: string): Promise<void> {
        await this.grpcClient.callCampaignService<
            { campaignId: string },
            { success: boolean; error?: string }
        >(
            "InvalidateCampaignCache",
            { campaignId },
            { timeout: 3000, retries: 1 },
        )
    }

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
