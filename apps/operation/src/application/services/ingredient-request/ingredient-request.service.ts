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
import {
    CreateIngredientRequestInput,
    IngredientRequestFilterInput,
    UpdateIngredientRequestStatusInput,
} from "../../dtos"
import { IngredientRequest } from "@app/operation/src/domain"
import { IngredientRequestStatus } from "@app/operation/src/domain/enums"
import { GrpcClientService } from "@libs/grpc"

@Injectable()
export class IngredientRequestService {
    constructor(
        private readonly repository: IngredientRequestRepository,
        private readonly authService: AuthorizationService,
        private readonly sentryService: SentryService,
        private readonly grpcClient: GrpcClientService,
    ) {}

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

            const totalCostNum = parseFloat(input.totalCost)
            if (isNaN(totalCostNum) || totalCostNum <= 0) {
                throw new BadRequestException(
                    "Total cost must be greater than 0",
                )
            }

            for (const item of input.items) {
                if (
                    item.estimatedUnitPrice <= 0 ||
                    item.estimatedTotalPrice <= 0
                ) {
                    throw new BadRequestException(
                        "All item prices must be greater than 0",
                    )
                }
            }

            const hasPending =
                await this.repository.hasPendingOrApprovedRequest(
                    input.campaignPhaseId,
                )
            if (hasPending) {
                throw new BadRequestException(
                    "Cannot create new request. There is already a PENDING or APPROVED request for this campaign phase. Please wait for admin approval.",
                )
            }

            const request = await this.repository.create(
                input,
                userContext.userId,
            )

            this.sentryService.addBreadcrumb(
                "Ingredient request created",
                "info",
                {
                    requestId: request.id,
                    kitchenStaffId: userContext.userId,
                    campaignPhaseId: input.campaignPhaseId,
                },
            )

            return request
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createIngredientRequest",
                userId: userContext.userId,
                campaignPhaseId: input.campaignPhaseId,
            })
            throw error
        }
    }

    async getRequestById(id: string): Promise<IngredientRequest> {
        try {
            const request = await this.repository.findById(id)

            if (!request) {
                throw new NotFoundException(
                    `Ingredient request with ID ${id} not found`,
                )
            }

            return request
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getIngredientRequestById",
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
            if (filter?.campaignId && !filter?.campaignPhaseId) {
                const campaignPhases = await this.getCampaignPhases(
                    filter.campaignId,
                )

                if (campaignPhases.length === 0) {
                    this.sentryService.addBreadcrumb(
                        "No campaign phases found for campaign",
                        "warning",
                        {
                            campaignId: filter.campaignId,
                        },
                    )
                    return []
                }

                const phaseIds = campaignPhases.map((phase) => phase.id)

                return await this.repository.findByMultipleCampaignPhases(
                    phaseIds,
                    filter.status,
                    filter.sortBy,
                    limit,
                    offset,
                )
            }

            return await this.repository.findMany(filter, limit, offset)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getIngredientRequests",
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

            return await this.repository.findByKitchenStaffId(
                userContext.userId,
                limit,
                offset,
            )
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getMyIngredientRequests",
                userId: userContext.userId,
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

            this.sentryService.addBreadcrumb(
                "Ingredient request status updated",
                "info",
                {
                    requestId: id,
                    oldStatus: existingRequest.status,
                    newStatus: input.status,
                    adminId: userContext.userId,
                },
            )

            return updatedRequest
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateIngredientRequestStatus",
                requestId: id,
                newStatus: input.status,
                adminId: userContext.userId,
            })
            throw error
        }
    }

    private async getCampaignPhases(campaignId: string): Promise<any[]> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { campaignId: string },
                {
                    success: boolean
                    phases: Array<{
                        id: string
                        campaignId: string
                        phaseName: string
                        location: string
                        ingredientPurchaseDate: string
                        cookingDate: string
                        deliveryDate: string
                    }>
                    error: string | null
                }
            >(
                "GetCampaignPhases",
                { campaignId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                throw new BadRequestException(
                    response.error || "Failed to fetch campaign phases",
                )
            }

            return response.phases || []
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "IngredientRequestService.getCampaignPhases",
                campaignId,
            })
            throw error
        }
    }
}
