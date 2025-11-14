import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { AuthorizationService, Role } from "@app/operation/src/shared"
import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { CurrentUserType } from "@libs/auth"
import {
    ConfirmDisbursementInput,
    CreateInflowTransactionInput,
    DisbursementConfirmationStatus,
    InflowTransactionListResponse,
} from "../../dtos"
import { InflowTransaction, InflowTransactionStatus, InflowTransactionType, IngredientRequestStatus, OperationRequestStatus } from "../../../domain"
import { IngredientRequestRepository, OperationRequestRepository } from "../../repositories"
import { PrismaClient } from "@app/operation/src/generated/operation-client"
import { InflowTransactionValidationService } from "./inflow-transaction-validation.service"
import { InflowTransactionFilterInput, MyInflowTransactionFilterInput } from "../../dtos/inflow-transaction/inflow-transaction-filter.input"

@Injectable()
export class InflowTransactionService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly validationService: InflowTransactionValidationService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    async createInflowTransaction(
        input: CreateInflowTransactionInput,
        user: CurrentUserType,
    ): Promise<InflowTransaction> {
        try {
            // Validate that exactly one request ID is provided
            if (input.ingredientRequestId && input.operationRequestId) {
                throw new BadRequestException(
                    "Cannot provide both ingredientRequestId and operationRequestId. Please provide only one.",
                )
            }

            if (!input.ingredientRequestId && !input.operationRequestId) {
                throw new BadRequestException(
                    "Must provide either ingredientRequestId or operationRequestId.",
                )
            }

            // Validate input and get fundraiser details
            const validation = await this.validationService.validateCreateInput(input)

            // Check for duplicate disbursement (each request can only be disbursed once)
            const isDuplicate = await this.validationService.checkDuplicateDisbursement(
                input.ingredientRequestId,
                input.operationRequestId,
            )

            if (isDuplicate) {
                throw new BadRequestException(
                    "This request has already been disbursed. Each request can only be disbursed once.",
                )
            }

            // Create inflow transaction
            const created = await this.prisma.inflow_Transaction.create({
                data: {
                    campaign_phase_id: validation.campaignPhaseId,
                    receiver_id: validation.fundraiserId,
                    ingredient_request_id: input.ingredientRequestId || null,
                    operation_request_id: input.operationRequestId || null,
                    transaction_type: validation.transactionType,
                    amount: BigInt(input.amount),
                    proof: input.proof.trim(),
                    status: InflowTransactionStatus.PENDING,
                    is_reported: false,
                },
            })

            this.sentryService.addBreadcrumb("Inflow transaction created", "disbursement", {
                id: created.id,
                type: validation.transactionType,
                amount: input.amount,
                campaignPhaseId: validation.campaignPhaseId,
                fundraiserId: validation.fundraiserId,
                ingredientRequestId: input.ingredientRequestId,
                operationRequestId: input.operationRequestId,
            })

            return this.mapToGraphQLModel(created)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "createInflowTransaction",
                input,
                userId: user.id,
            })
            throw error
        }
    }

    async confirmDisbursement(
        input: ConfirmDisbursementInput,
        user: CurrentUserType,
    ): Promise<InflowTransaction> {
        try {
            // Find the inflow transaction
            const transaction = await this.prisma.inflow_Transaction.findUnique({
                where: { id: input.id },
            })

            if (!transaction) {
                throw new NotFoundException(`Inflow transaction with ID ${input.id} not found`)
            }

            // Verify the receiver is the current user
            const receiver = await this.grpcClient.callUserService<
                { cognitoId: string },
                { id: string; cognitoId: string } | null
            >("GetUserByCognitoId", { cognitoId: user.id })

            if (!receiver || transaction.receiver_id !== receiver.id) {
                throw new ForbiddenException(
                    "You are not authorized to confirm this disbursement",
                )
            }

            // Verify transaction is in PENDING status
            if (transaction.status !== InflowTransactionStatus.PENDING) {
                throw new BadRequestException(
                    `Cannot confirm disbursement with status ${transaction.status}. ` +
                        "Only PENDING disbursements can be confirmed.",
                )
            }

            // Validate reason required for FAILED status
            if (
                input.status === DisbursementConfirmationStatus.FAILED &&
                (!input.reason || input.reason.trim().length === 0)
            ) {
                throw new BadRequestException("Reason is required when marking as FAILED")
            }

            // Update transaction status
            const updateData: any = {
                status:
                    input.status === DisbursementConfirmationStatus.COMPLETED
                        ? InflowTransactionStatus.COMPLETED
                        : InflowTransactionStatus.FAILED,
                updated_at: new Date(),
            }

            if (input.status === DisbursementConfirmationStatus.FAILED) {
                updateData.failed_reason = input.reason
            }

            // If COMPLETED, mark as reported and update linked request to DISBURSED
            if (input.status === DisbursementConfirmationStatus.COMPLETED) {
                updateData.is_reported = true
                updateData.reported_at = new Date()

                // Update linked request status to DISBURSED (if exists in schema)
                // Note: We need to track which request this is for
                // Since we don't have direct link, we'll find it by matching criteria
                await this.updateLinkedRequestToDisbursed(
                    transaction.campaign_phase_id,
                    transaction.amount,
                    transaction.transaction_type,
                )
            }

            const updated = await this.prisma.inflow_Transaction.update({
                where: { id: input.id },
                data: updateData,
            })

            this.sentryService.addBreadcrumb("Disbursement confirmed", "disbursement", {
                id: input.id,
                status: input.status,
                fundraiserId: receiver.id,
            })

            return this.mapToGraphQLModel(updated)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "confirmDisbursement",
                input,
                userId: user.id,
            })
            throw error
        }
    }

    /**
     * Admin gets all disbursements with filters
     */
    async getDisbursements(
        filter: InflowTransactionFilterInput,
        page: number = 1,
        limit: number = 10,
        user: CurrentUserType,
    ): Promise<InflowTransactionListResponse> {
        const where: any = {}

        if (filter.campaignPhaseId) {
            where.campaign_phase_id = filter.campaignPhaseId
        }

        if (filter.receiverId) {
            where.receiver_id = filter.receiverId
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

        const skip = (page - 1) * limit

        const [items, total] = await Promise.all([
            this.prisma.inflow_Transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: "desc" },
            }),
            this.prisma.inflow_Transaction.count({ where }),
        ])

        return {
            items: items.map((item) => this.mapToGraphQLModel(item)),
            total,
            page,
            limit,
            hasMore: skip + items.length < total,
        }
    }

    /**
     * Fundraiser gets their disbursements
     */
    async getMyDisbursements(
        filter: MyInflowTransactionFilterInput,
        page: number = 1,
        limit: number = 10,
        user: CurrentUserType,
    ): Promise<InflowTransactionListResponse> {
        // Get user ID from cognito ID
        const foundUser = await this.grpcClient.callUserService<
            { cognitoId: string },
            { id: string; cognitoId: string } | null
        >("GetUserByCognitoId", { cognitoId: user.id })

        if (!foundUser) {
            throw new NotFoundException("User not found")
        }

        const where: any = {
            receiver_id: foundUser.id,
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

        const skip = (page - 1) * limit

        const [items, total] = await Promise.all([
            this.prisma.inflow_Transaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: "desc" },
            }),
            this.prisma.inflow_Transaction.count({ where }),
        ])

        return {
            items: items.map((item) => this.mapToGraphQLModel(item)),
            total,
            page,
            limit,
            hasMore: skip + items.length < total,
        }
    }

    /**
     * Get single disbursement by ID (Admin or owner Fundraiser)
     */
    async getDisbursementById(
        id: string,
        user: CurrentUserType,
    ): Promise<InflowTransaction> {
        const transaction = await this.prisma.inflow_Transaction.findUnique({
            where: { id },
        })

        if (!transaction) {
            throw new NotFoundException(`Inflow transaction with ID ${id} not found`)
        }

        // If fundraiser, verify ownership
        if (user.attributes.role === Role.FUNDRAISER) {
            const foundUser = await this.grpcClient.callUserService<
                { cognitoId: string },
                { id: string; cognitoId: string } | null
            >("GetUserByCognitoId", { cognitoId: user.id })

            if (!foundUser || transaction.receiver_id !== foundUser.id) {
                throw new ForbiddenException("You are not authorized to view this disbursement")
            }
        }

        return this.mapToGraphQLModel(transaction)
    }

    /**
     * Helper: Update linked request to DISBURSED status
     */
    private async updateLinkedRequestToDisbursed(
        campaignPhaseId: string,
        amount: bigint,
        type: string,
    ): Promise<void> {
        try {
            if (type === InflowTransactionType.INGREDIENT) {
                // Find ingredient request by phase and amount
                const request = await this.prisma.ingredient_Request.findFirst({
                    where: {
                        campaign_phase_id: campaignPhaseId,
                        total_cost: amount,
                        status: IngredientRequestStatus.APPROVED,
                    },
                })

                if (request) {
                    await this.prisma.ingredient_Request.update({
                        where: { id: request.id },
                        data: {
                            status: "DISBURSED" as any, // Assuming DISBURSED status exists
                            changed_status_at: new Date(),
                        },
                    })
                }
            } else {
                // Find operation request by phase, amount, and type
                const request = await this.prisma.operation_Request.findFirst({
                    where: {
                        campaign_phase_id: campaignPhaseId,
                        total_cost: amount,
                        expense_type: type === InflowTransactionType.COOKING ? "COOKING" : "DELIVERY",
                        status: OperationRequestStatus.APPROVED,
                    },
                })

                if (request) {
                    await this.prisma.operation_Request.update({
                        where: { id: request.id },
                        data: {
                            status: "DISBURSED" as any, // Assuming DISBURSED status exists
                            changed_status_at: new Date(),
                        },
                    })
                }
            }
        } catch (error) {
            // Log error but don't fail the transaction
            this.sentryService.captureError(error as Error, {
                operation: "updateLinkedRequestToDisbursed",
                campaignPhaseId,
                amount: amount.toString(),
                type,
            })
        }
    }

    /**
     * Map Prisma model to GraphQL model
     */
    private mapToGraphQLModel(transaction: any): InflowTransaction {
        return {
            id: transaction.id,
            campaignPhaseId: transaction.campaign_phase_id,
            receiverId: transaction.receiver_id,
            transactionType: transaction.transaction_type as InflowTransactionType,
            amount: transaction.amount.toString(),
            status: transaction.status as InflowTransactionStatus,
            proof: transaction.proof,
            isReported: transaction.is_reported,
            reportedAt: transaction.reported_at,
            failedReason: transaction.failed_reason,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
        }
    }
}
