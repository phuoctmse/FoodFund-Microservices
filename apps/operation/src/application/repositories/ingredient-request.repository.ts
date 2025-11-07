import { Injectable } from "@nestjs/common"
import { IngredientRequest } from "../../domain/entities"
import { IngredientRequestStatus } from "../../domain/enums"
import { PrismaClient } from "../../generated/operation-client"
import { SentryService } from "@libs/observability"
import { CreateIngredientRequestInput } from "../dtos"
import { GrpcClientService } from "@libs/grpc"

@Injectable()
export class IngredientRequestRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
        private readonly grpcClient: GrpcClientService,
    ) {}

    async create(
        input: CreateIngredientRequestInput,
        kitchenStaffId: string,
    ): Promise<IngredientRequest> {
        try {
            const totalCostBigInt = BigInt(input.totalCost)

            const request = await this.prisma.ingredient_Request.create({
                data: {
                    campaign_phase_id: input.campaignPhaseId,
                    kitchen_staff_id: kitchenStaffId,
                    total_cost: totalCostBigInt,
                    status: "PENDING",
                    items: {
                        create: input.items.map((item) => ({
                            ingredient_name: item.ingredientName,
                            quantity: item.quantity,
                            estimated_unit_price: item.estimatedUnitPrice,
                            estimated_total_price: item.estimatedTotalPrice,
                            supplier: item.supplier,
                        })),
                    },
                },
                include: {
                    items: true,
                },
            })

            return this.mapToGraphQLModel(request)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createIngredientRequest",
                campaignPhaseId: input.campaignPhaseId,
                kitchenStaffId,
            })
            throw error
        }
    }

    async findById(id: string): Promise<IngredientRequest | null> {
        try {
            const request = await this.prisma.ingredient_Request.findUnique({
                where: { id },
                include: {
                    items: true,
                },
            })

            return request ? this.mapToGraphQLModel(request) : null
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestById",
                requestId: id,
            })
            throw error
        }
    }

    async findMany(
        filter?: { status?: IngredientRequestStatus },
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        try {
            const where: any = {}

            if (filter?.status) {
                where.status = filter.status
            }

            const requests = await this.prisma.ingredient_Request.findMany({
                where,
                include: {
                    items: true,
                },
                orderBy: {
                    created_at: "desc",
                },
                take: limit,
                skip: offset,
            })

            return requests.map((r) => this.mapToGraphQLModel(r))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findManyIngredientRequests",
                filter,
            })
            throw error
        }
    }

    async findByKitchenStaffOrganization(
        kitchenStaffId: string,
    ): Promise<IngredientRequest[]> {
        try {
            const response = await this.grpcClient.callUserService<
                { userId: string },
                {
                    success: boolean
                    members: Array<{
                        userId: string
                        role: string
                        fullName: string
                        email: string
                    }>
                    error?: string
                }
            >(
                "GetOrganizationMembers",
                { userId: kitchenStaffId },
                {
                    timeout: 5000,
                    retries: 2,
                },
            )

            if (!response.success || !response.members) {
                this.sentryService.addBreadcrumb(
                    "Failed to get organization members from User service",
                    "warning",
                    {
                        kitchenStaffId,
                        error: response.error,
                    },
                )

                return this.findByKitchenStaffId(kitchenStaffId, 100, 0)
            }

            const kitchenStaffIds = response.members
                .filter((member) => member.role === "KITCHEN_STAFF")
                .map((member) => member.userId)

            if (kitchenStaffIds.length === 0) {
                return this.findByKitchenStaffId(kitchenStaffId, 100, 0)
            }

            const requests = await this.prisma.ingredient_Request.findMany({
                where: {
                    kitchen_staff_id: {
                        in: kitchenStaffIds,
                    },
                },
                include: {
                    items: true,
                },
                orderBy: {
                    created_at: "desc",
                },
            })

            return requests.map((r) => this.mapToGraphQLModel(r))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestsByKitchenStaffOrganization",
                kitchenStaffId,
                errorType: error.name,
                errorMessage: error.message,
            })

            this.sentryService.addBreadcrumb(
                "User service call failed, returning only kitchen staff's own requests",
                "warning",
                {
                    kitchenStaffId,
                    error: error.message,
                },
            )

            return this.findByKitchenStaffId(kitchenStaffId, 100, 0)
        }
    }

    async findByKitchenStaffId(
        kitchenStaffId: string,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        try {
            const requests = await this.prisma.ingredient_Request.findMany({
                where: {
                    kitchen_staff_id: kitchenStaffId,
                },
                include: {
                    items: true,
                },
                orderBy: {
                    created_at: "desc",
                },
                take: limit,
                skip: offset,
            })

            return requests.map((r) => this.mapToGraphQLModel(r))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestsByKitchenStaff",
                kitchenStaffId,
            })
            throw error
        }
    }

    async findByCampaignPhaseId(
        campaignPhaseId: string,
    ): Promise<IngredientRequest[]> {
        try {
            const requests = await this.prisma.ingredient_Request.findMany({
                where: {
                    campaign_phase_id: campaignPhaseId,
                },
                include: {
                    items: true,
                },
                orderBy: {
                    created_at: "desc",
                },
            })

            return requests.map((r) => this.mapToGraphQLModel(r))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestsByCampaignPhase",
                campaignPhaseId,
            })
            throw error
        }
    }

    async getCampaignIdFromPhaseId(
        campaignPhaseId: string,
    ): Promise<string | null> {
        try {
            const response = await this.grpcClient.callCampaignService<
                { phaseId: string },
                {
                    success: boolean
                    campaignId?: string
                    error?: string
                }
            >(
                "GetCampaignIdByPhaseId",
                { phaseId: campaignPhaseId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success || !response.campaignId) {
                this.sentryService.addBreadcrumb(
                    "Failed to get campaign ID from Campaign service",
                    "warning",
                    {
                        campaignPhaseId,
                        error: response.error,
                    },
                )
                return null
            }

            return response.campaignId
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getCampaignIdFromPhaseId",
                campaignPhaseId,
            })
            return null
        }
    }

    async updateStatus(
        id: string,
        status: IngredientRequestStatus,
    ): Promise<IngredientRequest> {
        try {
            const request = await this.prisma.ingredient_Request.update({
                where: { id },
                data: {
                    status,
                    changed_status_at: new Date(),
                },
                include: {
                    items: true,
                },
            })

            return this.mapToGraphQLModel(request)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "updateIngredientRequestStatus",
                requestId: id,
                status,
            })
            throw error
        }
    }

    async hasPendingOrApprovedRequest(
        campaignPhaseId: string,
    ): Promise<boolean> {
        try {
            const count = await this.prisma.ingredient_Request.count({
                where: {
                    campaign_phase_id: campaignPhaseId,
                    status: {
                        in: ["PENDING", "APPROVED"],
                    },
                },
            })

            return count > 0
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "checkPendingOrApprovedRequest",
                campaignPhaseId,
            })
            throw error
        }
    }

    private mapToGraphQLModel(request: any): IngredientRequest {
        return {
            id: request.id,
            campaignPhaseId: request.campaign_phase_id,
            kitchenStaffId: request.kitchen_staff_id,
            totalCost: request.total_cost.toString(),
            status: request.status as IngredientRequestStatus,
            changedStatusAt: request.changed_status_at,
            created_at: request.created_at,
            updated_at: request.updated_at,
            items: request.items.map((item: any) => ({
                id: item.id,
                requestId: item.request_id,
                ingredientName: item.ingredient_name,
                quantity: item.quantity,
                estimatedUnitPrice: item.estimated_unit_price,
                estimatedTotalPrice: item.estimated_total_price,
                supplier: item.supplier,
            })),
            kitchenStaff: {
                __typename: "User",
                id: request.kitchen_staff_id,
            },
            campaignPhase: {
                __typename: "CampaignPhase",
                id: request.campaign_phase_id,
            },
        } as IngredientRequest
    }
}
