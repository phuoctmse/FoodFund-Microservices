import { Injectable } from "@nestjs/common"
import { PrismaClient, Prisma } from "@app/operation/src/generated/operation-client"
import { SentryService } from "@libs/observability"
import {
    InflowTransaction,
    InflowTransactionStatus,
    InflowTransactionType,
    IngredientRequestStatus,
    OperationRequestStatus,
} from "../../domain"
import {
    InflowTransactionFilterInput,
    MyInflowTransactionFilterInput,
} from "../dtos/inflow-transaction/inflow-transaction-filter.input"

export interface CreateInflowTransactionData {
    campaignPhaseId: string
    receiverId: string
    ingredientRequestId?: string | null
    operationRequestId?: string | null
    transactionType: InflowTransactionType | string
    amount: bigint
    proof: string
    status: InflowTransactionStatus
}

export interface UpdateInflowTransactionStatusData {
    status: InflowTransactionStatus
    isReported?: boolean
    reportedAt?: Date
}

@Injectable()
export class InflowTransactionRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(data: CreateInflowTransactionData): Promise<any> {
        return await this.prisma.inflow_Transaction.create({
            data: {
                campaign_phase_id: data.campaignPhaseId,
                receiver_id: data.receiverId,
                ingredient_request_id: data.ingredientRequestId || null,
                operation_request_id: data.operationRequestId || null,
                transaction_type: data.transactionType as any,
                amount: data.amount,
                proof: data.proof,
                status: data.status as any,
                is_reported: false,
            },
        })
    }

    async findById(id: string): Promise<any | null> {
        return await this.prisma.inflow_Transaction.findUnique({
            where: { id },
        })
    }

    async findMany(
        filter: InflowTransactionFilterInput,
        limit: number = 10,
        offset: number = 0,
    ): Promise<{ items: any[]; total: number }> {
        const where = this.buildWhereClause(filter)

        const [items, total] = await Promise.all([
            this.prisma.inflow_Transaction.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { created_at: "desc" },
            }),
            this.prisma.inflow_Transaction.count({ where }),
        ])

        return { items, total }
    }

    async findByReceiverId(
        receiverId: string,
        filter: MyInflowTransactionFilterInput,
        limit: number = 10,
        offset: number = 0,
    ): Promise<{ items: any[]; total: number }> {
        const where = this.buildWhereClause(filter, receiverId)

        const [items, total] = await Promise.all([
            this.prisma.inflow_Transaction.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { created_at: "desc" },
            }),
            this.prisma.inflow_Transaction.count({ where }),
        ])

        return { items, total }
    }

    async updateStatus(
        id: string,
        data: UpdateInflowTransactionStatusData,
    ): Promise<any> {
        const updateData: any = {
            status: data.status,
            updated_at: new Date(),
        }

        if (data.isReported !== undefined) {
            updateData.is_reported = data.isReported
        }

        if (data.reportedAt !== undefined) {
            updateData.reported_at = data.reportedAt
        }

        return await this.prisma.inflow_Transaction.update({
            where: { id },
            data: updateData,
        })
    }

    async hasDuplicateDisbursement(
        ingredientRequestId?: string,
        operationRequestId?: string,
    ): Promise<boolean> {
        const where: any = {
            status: {
                in: [InflowTransactionStatus.COMPLETED, InflowTransactionStatus.PENDING],
            },
        }

        if (ingredientRequestId) {
            where.ingredient_request_id = ingredientRequestId
        }

        if (operationRequestId) {
            where.operation_request_id = operationRequestId
        }

        const count = await this.prisma.inflow_Transaction.count({
            where,
        })

        return count > 0
    }

    /**
     * Update ingredient request status to DISBURSED
     * SECURITY: Uses direct ID to ensure correct request is updated
     */
    async updateIngredientRequestStatus(
        ingredientRequestId: string,
        status: "DISBURSED",
    ): Promise<void> {
        const ingredientRequest = await this.prisma.ingredient_Request.findUnique({
            where: { id: ingredientRequestId },
        })

        if (!ingredientRequest) {
            this.sentryService.captureError(
                new Error(`Ingredient request ${ingredientRequestId} not found`),
                {
                    operation: "updateIngredientRequestStatus",
                    ingredientRequestId,
                },
            )
            return
        }

        // Verify the request is in APPROVED status before updating
        if (ingredientRequest.status !== IngredientRequestStatus.APPROVED) {
            this.sentryService.captureError(
                new Error(
                    `Ingredient request ${ingredientRequestId} is not in APPROVED status (current: ${ingredientRequest.status})`,
                ),
                {
                    operation: "updateIngredientRequestStatus",
                    ingredientRequestId,
                    currentStatus: ingredientRequest.status,
                },
            )
            return
        }

        await this.prisma.ingredient_Request.update({
            where: { id: ingredientRequestId },
            data: {
                status: IngredientRequestStatus.DISBURSED,
                changed_status_at: new Date(),
            },
        })

        this.sentryService.addBreadcrumb(
            "Ingredient request marked as DISBURSED",
            "disbursement",
            {
                ingredientRequestId,
            },
        )
    }

    /**
     * Update operation request status to DISBURSED
     * SECURITY: Uses direct ID to ensure correct request is updated
     */
    async updateOperationRequestStatus(
        operationRequestId: string,
        status: "DISBURSED",
    ): Promise<void> {
        const operationRequest = await this.prisma.operation_Request.findUnique({
            where: { id: operationRequestId },
        })

        if (!operationRequest) {
            this.sentryService.captureError(
                new Error(`Operation request ${operationRequestId} not found`),
                {
                    operation: "updateOperationRequestStatus",
                    operationRequestId,
                },
            )
            return
        }

        // Verify the request is in APPROVED status before updating
        if (operationRequest.status !== OperationRequestStatus.APPROVED) {
            this.sentryService.captureError(
                new Error(
                    `Operation request ${operationRequestId} is not in APPROVED status (current: ${operationRequest.status})`,
                ),
                {
                    operation: "updateOperationRequestStatus",
                    operationRequestId,
                    currentStatus: operationRequest.status,
                },
            )
            return
        }

        await this.prisma.operation_Request.update({
            where: { id: operationRequestId },
            data: {
                status: OperationRequestStatus.DISBURSED,
                changed_status_at: new Date(),
            },
        })

        this.sentryService.addBreadcrumb(
            "Operation request marked as DISBURSED",
            "disbursement",
            {
                operationRequestId,
            },
        )
    }

    private buildWhereClause(
        filter: InflowTransactionFilterInput | MyInflowTransactionFilterInput,
        receiverId?: string,
    ): Prisma.Inflow_TransactionWhereInput {
        const where: Prisma.Inflow_TransactionWhereInput = {}

        if (receiverId) {
            where.receiver_id = receiverId
        }

        if ("receiverId" in filter && filter.receiverId) {
            where.receiver_id = filter.receiverId
        }

        if (filter.campaignPhaseId) {
            where.campaign_phase_id = filter.campaignPhaseId
        }

        if (filter.transactionType) {
            where.transaction_type = filter.transactionType
        }

        if (filter.status) {
            where.status = filter.status
        }

        if (filter.fromDate || filter.toDate) {
            where.created_at = {}
            if (filter.fromDate) {
                where.created_at.gte = filter.fromDate
            }
            if (filter.toDate) {
                where.created_at.lte = filter.toDate
            }
        }

        return where
    }
}

