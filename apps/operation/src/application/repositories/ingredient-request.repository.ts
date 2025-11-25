import { Injectable } from "@nestjs/common"
import { IngredientRequest } from "../../domain/entities"
import {
    IngredientRequestSortOrder,
    IngredientRequestStatus,
} from "../../domain/enums"
import { Prisma, PrismaClient } from "../../generated/operation-client"
import { SentryService } from "@libs/observability"
import {
    CreateIngredientRequestInput,
    IngredientRequestFilterInput,
} from "../dtos"
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
        organizatonId: string
    ): Promise<IngredientRequest> {
        const totalCostBigInt = BigInt(input.totalCost)

        const request = await this.prisma.ingredient_Request.create({
            data: {
                campaign_phase_id: input.campaignPhaseId,
                kitchen_staff_id: kitchenStaffId,
                organization_id: organizatonId,
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
    }

    async findById(id: string): Promise<IngredientRequest | null> {
        const request = await this.prisma.ingredient_Request.findUnique({
            where: { id },
            include: {
                items: true,
            },
        })

        return request ? this.mapToGraphQLModel(request) : null
    }

    async findMany(
        filter?: IngredientRequestFilterInput,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        const where: Prisma.Ingredient_RequestWhereInput = {}

        if (filter?.campaignPhaseId) {
            where.campaign_phase_id = filter.campaignPhaseId
        }

        if (filter?.status) {
            where.status = filter.status
        }

        const orderBy = this.buildOrderByClause(
            filter?.sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
        )

        const requests = await this.prisma.ingredient_Request.findMany({
            where,
            include: {
                items: true,
            },
            orderBy,
            take: limit,
            skip: offset,
        })

        return requests.map((r) => this.mapToGraphQLModel(r))
    }

    async findByMultipleCampaignPhases(
        phaseIds: string[],
        status?: IngredientRequestStatus,
        sortBy?: IngredientRequestSortOrder,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
        if (phaseIds.length === 0) {
            return []
        }

        const where: Prisma.Ingredient_RequestWhereInput = {
            campaign_phase_id: {
                in: phaseIds,
            },
        }

        if (status) {
            where.status = status
        }

        const orderBy = this.buildOrderByClause(
            sortBy || IngredientRequestSortOrder.NEWEST_FIRST,
        )

        const requests = await this.prisma.ingredient_Request.findMany({
            where,
            include: {
                items: true,
            },
            orderBy,
            take: limit,
            skip: offset,
        })

        return requests.map((r) => this.mapToGraphQLModel(r))
    }

    async findByKitchenStaffOrganization(
        kitchenStaffId: string,
    ): Promise<IngredientRequest[]> {
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
    }

    async findByKitchenStaffId(
        kitchenStaffId: string,
        limit: number = 10,
        offset: number = 0,
    ): Promise<IngredientRequest[]> {
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
    }

    async findByCampaignPhaseId(
        campaignPhaseId: string,
    ): Promise<IngredientRequest[]> {
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
    }

    async getCampaignIdFromPhaseId(
        campaignPhaseId: string,
    ): Promise<string | null> {
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
    }

    async updateStatus(
        id: string,
        status: IngredientRequestStatus,
    ): Promise<IngredientRequest> {
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
    }

    async hasPendingOrApprovedRequest(
        campaignPhaseId: string,
    ): Promise<boolean> {
        const count = await this.prisma.ingredient_Request.count({
            where: {
                campaign_phase_id: campaignPhaseId,
                status: {
                    in: ["PENDING", "APPROVED"],
                },
            },
        })

        return count > 0
    }

    private buildOrderByClause(
        sortBy: IngredientRequestSortOrder,
    ): Prisma.Ingredient_RequestOrderByWithRelationInput {
        switch (sortBy) {
        case IngredientRequestSortOrder.OLDEST_FIRST:
            return { created_at: "asc" }
        case IngredientRequestSortOrder.NEWEST_FIRST:
        default:
            return { created_at: "desc" }
        }
    }

    private mapToGraphQLModel(request: any): IngredientRequest {
        return {
            id: request.id,
            campaignPhaseId: request.campaign_phase_id,
            kitchenStaffId: request.kitchen_staff_id,
            organizationId: request.organization_id || undefined,
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
            organization: {
                __typename: "Organization",
                id: request.organization_id,
            },
        } as IngredientRequest
    }
}
