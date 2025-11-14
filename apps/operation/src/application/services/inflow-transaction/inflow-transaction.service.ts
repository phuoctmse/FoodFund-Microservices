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
    UpdateIngredientRequestStatusInput,
} from "../../dtos"
import { InflowTransaction, InflowTransactionStatus, InflowTransactionType, IngredientRequestStatus } from "../../../domain"
import { InflowTransactionRepository } from "../../repositories"
import { InflowTransactionValidationService } from "./inflow-transaction-validation.service"
import { InflowTransactionFilterInput, MyInflowTransactionFilterInput } from "../../dtos/inflow-transaction/inflow-transaction-filter.input"

@Injectable()
export class InflowTransactionService {
    constructor(
        private readonly inflowTransactionRepository: InflowTransactionRepository,
        private readonly validationService: InflowTransactionValidationService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Helper: Execute operation with error handling and Sentry logging
     */
    private async executeWithErrorHandling<T>(
        operation: string,
        fn: () => Promise<T>,
        context: Record<string, any>,
    ): Promise<T> {
        try {
            return await fn()
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation,
                ...context,
            })
            throw error
        }
    }

    /**
     * Helper: Get user by Cognito ID
     */
    private async getUserByCognitoId(cognitoId: string): Promise<{ id: string; cognitoId: string }> {
        const user = await this.grpcClient.callUserService<
            { cognitoId: string },
            { id: string; cognitoId: string } | null
        >("GetUserByCognitoId", { cognitoId })

        if (!user) {
            throw new NotFoundException("User not found")
        }

        return user
    }

    async createInflowTransaction(
        input: CreateInflowTransactionInput,
        user: CurrentUserType,
    ): Promise<InflowTransaction> {
        return this.executeWithErrorHandling(
            "createInflowTransaction",
            async () => {
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
                const isDuplicate = await this.inflowTransactionRepository.hasDuplicateDisbursement(
                    input.ingredientRequestId,
                    input.operationRequestId,
                )

                if (isDuplicate) {
                    throw new BadRequestException(
                        "This request has already been disbursed. Each request can only be disbursed once.",
                    )
                }

                // Create inflow transaction
                const created = await this.inflowTransactionRepository.create({
                    campaignPhaseId: validation.campaignPhaseId,
                    receiverId: validation.fundraiserId,
                    ingredientRequestId: input.ingredientRequestId,
                    operationRequestId: input.operationRequestId,
                    transactionType: validation.transactionType,
                    amount: BigInt(input.amount),
                    proof: input.proof.trim(),
                    status: InflowTransactionStatus.PENDING,
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
            },
            { input, userId: user.id },
        )
    }

    async confirmDisbursement(
        input: ConfirmDisbursementInput,
        user: CurrentUserType,
    ): Promise<InflowTransaction> {
        return this.executeWithErrorHandling(
            "confirmDisbursement",
            async () => {
                // Find the inflow transaction
                const transaction = await this.inflowTransactionRepository.findById(input.id)

                if (!transaction) {
                    throw new NotFoundException(`Inflow transaction with ID ${input.id} not found`)
                }

                // Verify the receiver is the current user
                const receiver = await this.getUserByCognitoId(user.id)

                if (transaction.receiver_id !== receiver.id) {
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

                // Prepare update data
                const newStatus =
                    input.status === DisbursementConfirmationStatus.COMPLETED
                        ? InflowTransactionStatus.COMPLETED
                        : InflowTransactionStatus.FAILED

                const updateData: any = {
                    status: newStatus,
                }

                if (input.status === DisbursementConfirmationStatus.FAILED) {
                    updateData.failedReason = input.reason
                }

                // If COMPLETED, mark as reported and update linked request to DISBURSED
                if (input.status === DisbursementConfirmationStatus.COMPLETED) {
                    updateData.isReported = true
                    updateData.reportedAt = new Date()

                    // Update linked request status to DISBURSED using direct foreign key
                    await this.updateLinkedRequestToDisbursed(
                        transaction.ingredient_request_id,
                        transaction.operation_request_id,
                    )
                }

                const updated = await this.inflowTransactionRepository.updateStatus(
                    input.id,
                    updateData,
                )

                this.sentryService.addBreadcrumb("Disbursement confirmed", "disbursement", {
                    id: input.id,
                    status: input.status,
                    fundraiserId: receiver.id,
                })

                return this.mapToGraphQLModel(updated)
            },
            { input, userId: user.id },
        )
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
        const skip = (page - 1) * limit

        const { items, total } = await this.inflowTransactionRepository.findMany(
            filter,
            limit,
            skip,
        )

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
        const foundUser = await this.getUserByCognitoId(user.id)
        const skip = (page - 1) * limit

        const { items, total } = await this.inflowTransactionRepository.findByReceiverId(
            foundUser.id,
            filter,
            limit,
            skip,
        )

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
        const transaction = await this.inflowTransactionRepository.findById(id)

        if (!transaction) {
            throw new NotFoundException(`Inflow transaction with ID ${id} not found`)
        }

        // If fundraiser, verify ownership
        if (user.attributes.role === Role.FUNDRAISER) {
            const foundUser = await this.getUserByCognitoId(user.id)

            if (transaction.receiver_id !== foundUser.id) {
                throw new ForbiddenException("You are not authorized to view this disbursement")
            }
        }

        return this.mapToGraphQLModel(transaction)
    }

    /**
     * Helper: Update linked request to DISBURSED status
     * SECURITY: Uses direct foreign key IDs to ensure the correct request is updated
     */
    private async updateLinkedRequestToDisbursed(
        ingredientRequestId: string | null,
        operationRequestId: string | null,
    ): Promise<void> {
        try {
            // Update ingredient request if linked
            if (ingredientRequestId) {
                await this.inflowTransactionRepository.updateIngredientRequestStatus(
                    ingredientRequestId,
                    IngredientRequestStatus.DISBURSED,
                )
            }

            // Update operation request if linked
            if (operationRequestId) {
                await this.inflowTransactionRepository.updateOperationRequestStatus(
                    operationRequestId,
                    "DISBURSED",
                )
            }
        } catch (error) {
            // Log error but don't fail the transaction confirmation
            this.sentryService.captureError(error as Error, {
                operation: "updateLinkedRequestToDisbursed",
                ingredientRequestId,
                operationRequestId,
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
