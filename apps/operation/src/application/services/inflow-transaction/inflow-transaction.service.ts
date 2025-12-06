import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { Role } from "@app/operation/src/shared"
import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { CurrentUserType } from "@libs/auth"
import {
    ConfirmDisbursementInput,
    CreateInflowTransactionInput,
    DisbursementConfirmationStatus,
    InflowTransactionListResponse,
} from "../../dtos"
import {
    InflowTransaction,
    InflowTransactionStatus,
    InflowTransactionType,
    IngredientRequestStatus,
} from "../../../domain"
import {
    InflowTransactionRepository,
    IngredientRequestRepository,
    OperationRequestRepository,
} from "../../repositories"
import { InflowTransactionValidationService } from "./inflow-transaction-validation.service"
import {
    InflowTransactionFilterInput,
    MyInflowTransactionFilterInput,
} from "../../dtos/inflow-transaction/inflow-transaction-filter.input"
import { IngredientRequestCacheService } from "../ingredient-request"
import { OperationRequestCacheService } from "../operation-request"

type RequestExpenseType = "INGREDIENT" | "COOKING" | "DELIVERY"

interface SurplusTransferResult {
    transferred: boolean
    surplusAmount: bigint
    walletTransactionId?: string
    error?: string
}

@Injectable()
export class InflowTransactionService {
    constructor(
        private readonly inflowTransactionRepository: InflowTransactionRepository,
        private readonly validationService: InflowTransactionValidationService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
        private readonly ingredientRequestCacheService: IngredientRequestCacheService,
        private readonly operationRequestCacheService: OperationRequestCacheService,
        private readonly ingredientRequestRepository: IngredientRequestRepository,
        private readonly operationRequestRepository: OperationRequestRepository,
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
    private async getUserByCognitoId(
        cognitoId: string,
    ): Promise<{ id: string; cognitoId: string }> {
        const response = await this.grpcClient.callUserService<
            { cognitoId: string },
            { success: boolean; user?: any; error?: string }
        >("GetUser", { cognitoId })

        if (!response.success || !response.user) {
            throw new NotFoundException(response.error || "User not found")
        }

        return {
            id: response.user.id,
            cognitoId: response.user.cognitoId,
        }
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

                const validation =
                    await this.validationService.validateCreateInput(input)

                const isDuplicate =
                    await this.inflowTransactionRepository.hasDuplicateDisbursement(
                        input.ingredientRequestId,
                        input.operationRequestId,
                    )

                if (isDuplicate) {
                    throw new BadRequestException(
                        "This request already has a pending or completed disbursement. " +
                            "Each request can only have one active disbursement at a time.",
                    )
                }

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

                await this.updateLinkedRequestToDisbursed(
                    input.ingredientRequestId || null,
                    input.operationRequestId || null,
                )

                await this.invalidateRequestCaches(
                    input.ingredientRequestId || null,
                    input.operationRequestId || null,
                    validation.campaignPhaseId,
                )

                await this.calculateAndTransferSurplus(
                    input.ingredientRequestId || null,
                    input.operationRequestId || null,
                    validation.campaignPhaseId,
                    validation.fundraiserId,
                )

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
                const transaction =
                    await this.inflowTransactionRepository.findById(input.id)

                if (!transaction) {
                    throw new NotFoundException(
                        `Inflow transaction with ID ${input.id} not found`,
                    )
                }

                // Verify the receiver is the current user
                const receiver = await this.getUserByCognitoId(user.id)

                if (transaction.receiver_id !== receiver.cognitoId) {
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

                // Prepare update data
                const newStatus =
                    input.status === DisbursementConfirmationStatus.COMPLETED
                        ? InflowTransactionStatus.COMPLETED
                        : InflowTransactionStatus.FAILED

                const updateData: any = {
                    status: newStatus,
                    isReported: true,
                    reportedAt: new Date(),
                }

                if (input.status === DisbursementConfirmationStatus.COMPLETED) {
                    // Update linked request status to DISBURSED using direct foreign key
                    await this.updateLinkedRequestToDisbursed(
                        transaction.ingredient_request_id,
                        transaction.operation_request_id,
                    )
                    await this.invalidateRequestCaches(
                        transaction.ingredient_request_id,
                        transaction.operation_request_id,
                        transaction.campaign_phase_id,
                    )
                }

                const updated =
                    await this.inflowTransactionRepository.updateStatus(
                        input.id,
                        updateData,
                    )

                this.sentryService.addBreadcrumb(
                    "Disbursement confirmed",
                    "disbursement",
                    {
                        id: input.id,
                        status: input.status,
                        fundraiserId: receiver.id,
                    },
                )

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
        user: CurrentUserType,
        page: number = 1,
        limit: number = 10,
    ): Promise<InflowTransactionListResponse> {
        const skip = (page - 1) * limit

        const { items, total } =
            await this.inflowTransactionRepository.findMany(filter, limit, skip)

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
        user: CurrentUserType,
        page: number = 1,
        limit: number = 10,
    ): Promise<InflowTransactionListResponse> {
        const foundUser = await this.getUserByCognitoId(user.id)
        const skip = (page - 1) * limit

        const { items, total } =
            await this.inflowTransactionRepository.findByReceiverId(
                foundUser.cognitoId,
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
            throw new NotFoundException(
                `Inflow transaction with ID ${id} not found`,
            )
        }

        // If fundraiser, verify ownership
        if (user.attributes.role === Role.FUNDRAISER) {
            const foundUser = await this.getUserByCognitoId(user.id)

            if (transaction.receiver_id !== foundUser.cognitoId) {
                throw new ForbiddenException(
                    "You are not authorized to view this disbursement",
                )
            }
        }

        return this.mapToGraphQLModel(transaction)
    }

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

    private async invalidateRequestCaches(
        ingredientRequestId: string | null,
        operationRequestId: string | null,
        campaignPhaseId: string,
    ): Promise<void> {
        try {
            const invalidationPromises: Promise<void>[] = []

            if (ingredientRequestId) {
                invalidationPromises.push(
                    this.ingredientRequestCacheService.invalidateRequest(
                        ingredientRequestId,
                        campaignPhaseId,
                    ),
                )
            }

            if (operationRequestId) {
                invalidationPromises.push(
                    this.operationRequestCacheService.invalidateRequest(
                        operationRequestId,
                        campaignPhaseId,
                    ),
                )
            }

            if (invalidationPromises.length > 0) {
                await Promise.all(invalidationPromises)
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "invalidateRequestCaches",
                ingredientRequestId,
                operationRequestId,
                campaignPhaseId,
            })
        }
    }

    private async calculateAndTransferSurplus(
        ingredientRequestId: string | null,
        operationRequestId: string | null,
        campaignPhaseId: string,
        fundraiserId: string,
    ): Promise<SurplusTransferResult> {
        try {
            const phaseInfo = await this.getCampaignPhaseInfo(campaignPhaseId)

            if (!phaseInfo) {
                return { transferred: false, surplusAmount: BigInt(0) }
            }

            let budget: bigint
            let actualCost: bigint
            let requestType: RequestExpenseType
            let requestId: string

            if (ingredientRequestId) {
                const request =
                    await this.ingredientRequestRepository.findById(
                        ingredientRequestId,
                    )
                if (!request) {
                    return { transferred: false, surplusAmount: BigInt(0) }
                }

                budget = BigInt(phaseInfo.ingredientFundsAmount || 0)
                actualCost = BigInt(request.totalCost)
                requestType = "INGREDIENT"
                requestId = ingredientRequestId
            } else if (operationRequestId) {
                const request =
                    await this.operationRequestRepository.findById(
                        operationRequestId,
                    )
                if (!request) {
                    return { transferred: false, surplusAmount: BigInt(0) }
                }

                if (request.expense_type === "COOKING") {
                    budget = BigInt(phaseInfo.cookingFundsAmount || 0)
                    requestType = "COOKING"
                } else if (request.expense_type === "DELIVERY") {
                    budget = BigInt(phaseInfo.deliveryFundsAmount || 0)
                    requestType = "DELIVERY"
                } else {
                    return { transferred: false, surplusAmount: BigInt(0) }
                }

                actualCost = request.total_cost
                requestId = operationRequestId
            } else {
                return { transferred: false, surplusAmount: BigInt(0) }
            }

            const surplus = budget - actualCost

            if (surplus <= BigInt(0)) {
                return { transferred: false, surplusAmount: BigInt(0) }
            }

            const transferResult = await this.creditFundraiserWalletWithSurplus(
                {
                    fundraiserId,
                    campaignId: phaseInfo.campaignId,
                    campaignPhaseId,
                    requestId,
                    requestType,
                    surplusAmount: surplus.toString(),
                    originalBudget: budget.toString(),
                    actualCost: actualCost.toString(),
                    campaignTitle: phaseInfo.campaignTitle,
                    phaseName: phaseInfo.phaseName,
                },
            )

            if (!transferResult.success) {
                return {
                    transferred: false,
                    surplusAmount: surplus,
                    error: transferResult.error,
                }
            }

            await this.sendSurplusNotification({
                fundraiserId,
                requestId,
                requestType,
                campaignTitle: phaseInfo.campaignTitle,
                phaseName: phaseInfo.phaseName,
                originalBudget: budget.toString(),
                actualCost: actualCost.toString(),
                surplusAmount: surplus.toString(),
                walletTransactionId: transferResult.walletTransactionId,
            })

            return {
                transferred: true,
                surplusAmount: surplus,
                walletTransactionId: transferResult.walletTransactionId,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "calculateAndTransferSurplus",
                ingredientRequestId,
                operationRequestId,
                campaignPhaseId,
                fundraiserId,
            })
            return {
                transferred: false,
                surplusAmount: BigInt(0),
                error: error?.message,
            }
        }
    }

    private async getCampaignPhaseInfo(campaignPhaseId: string): Promise<{
        campaignId: string
        campaignTitle: string
        phaseName: string
        ingredientFundsAmount: string
        cookingFundsAmount: string
        deliveryFundsAmount: string
    } | null> {
        const response = await this.grpcClient.callCampaignService<
            { phaseId: string },
            {
                success: boolean
                phase?: {
                    id: string
                    campaignId: string
                    campaignTitle: string
                    phaseName: string
                    ingredientFundsAmount: string
                    cookingFundsAmount: string
                    deliveryFundsAmount: string
                }
                error?: string
            }
        >("GetCampaignPhaseInfo", { phaseId: campaignPhaseId })

        if (!response.success || !response.phase) {
            return null
        }

        return response.phase
    }

    private async creditFundraiserWalletWithSurplus(data: {
        fundraiserId: string
        campaignId: string
        campaignPhaseId: string
        requestId: string
        requestType: RequestExpenseType
        surplusAmount: string
        originalBudget: string
        actualCost: string
        campaignTitle: string
        phaseName: string
    }): Promise<{
        success: boolean
        walletTransactionId?: string
        newBalance?: string
        error?: string
    }> {
        try {
            const response = await this.grpcClient.callUserService<
                {
                    fundraiserId: string
                    campaignId: string
                    campaignPhaseId: string
                    requestId: string
                    requestType: string
                    surplusAmount: string
                    originalBudget: string
                    actualCost: string
                    campaignTitle: string
                    phaseName: string
                },
                {
                    success: boolean
                    walletTransactionId?: string
                    newBalance?: string
                    error?: string
                }
            >("CreditFundraiserWalletWithSurplus", {
                fundraiserId: data.fundraiserId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                requestId: data.requestId,
                requestType: data.requestType,
                surplusAmount: data.surplusAmount,
                originalBudget: data.originalBudget,
                actualCost: data.actualCost,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
            })

            return response
        } catch (error) {
            return {
                success: false,
                error: (error as Error)?.message || "gRPC call failed",
            }
        }
    }

    private async sendSurplusNotification(data: {
        fundraiserId: string
        requestId: string
        requestType: RequestExpenseType
        campaignTitle: string
        phaseName: string
        originalBudget: string
        actualCost: string
        surplusAmount: string
        walletTransactionId?: string
    }): Promise<void> {
        const notificationData = {
            requestId: data.requestId,
            requestType: data.requestType,
            campaignTitle: data.campaignTitle,
            phaseName: data.phaseName,
            originalBudget: data.originalBudget,
            actualCost: data.actualCost,
            surplusAmount: data.surplusAmount,
            walletTransactionId: data.walletTransactionId,
        }
        await this.grpcClient.callCampaignService<
            {
                userId: string
                notificationType: string
                dataJson: string
            },
            { success: boolean; error?: string }
        >("SendNotification", {
            userId: data.fundraiserId,
            notificationType: "SURPLUS_TRANSFERRED",
            dataJson: JSON.stringify(notificationData),
        })
    }

    /**
     * Map Prisma model to GraphQL model (without conversion)
     * Used when receiverId is already internal id
     */
    private mapToGraphQLModel(transaction: any): InflowTransaction {
        return {
            id: transaction.id,
            campaignPhaseId: transaction.campaign_phase_id,
            receiverId: transaction.receiver_id,
            ingredientRequestId: transaction.ingredient_request_id,
            operationRequestId: transaction.operation_request_id,
            transactionType:
                transaction.transaction_type as InflowTransactionType,
            amount: transaction.amount.toString(),
            status: transaction.status as InflowTransactionStatus,
            proof: transaction.proof,
            isReported: transaction.is_reported,
            reportedAt: transaction.reported_at,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
        }
    }

    /**
     * Map Prisma model to GraphQL model with cognito_id → internal id conversion
     */
    private async mapToGraphQLModelWithConversion(
        transaction: any,
    ): Promise<InflowTransaction> {
        console.log("🔍 [mapToGraphQLModelWithConversion] Input:", {
            id: transaction.id,
            campaign_phase_id: transaction.campaign_phase_id,
            receiver_id: transaction.receiver_id,
        })

        let internalUserId = transaction.receiver_id

        // Convert cognito_id to internal user id
        if (transaction.receiver_id) {
            try {
                const userResponse = await this.getUserByCognitoId(
                    transaction.receiver_id,
                )
                internalUserId = userResponse.id
                console.log(
                    "✅ [mapToGraphQLModelWithConversion] Converted cognito_id to internal id:",
                    {
                        cognitoId: transaction.receiver_id,
                        internalId: internalUserId,
                    },
                )
            } catch (error) {
                console.error(
                    "❌ [mapToGraphQLModelWithConversion] Failed to convert:",
                    error,
                )
                // Keep cognito_id if conversion fails
            }
        }

        const mapped = {
            id: transaction.id,
            campaignPhaseId: transaction.campaign_phase_id,
            receiverId: internalUserId,
            ingredientRequestId: transaction.ingredient_request_id,
            operationRequestId: transaction.operation_request_id,
            transactionType:
                transaction.transaction_type as InflowTransactionType,
            amount: transaction.amount.toString(),
            status: transaction.status as InflowTransactionStatus,
            proof: transaction.proof,
            isReported: transaction.is_reported,
            reportedAt: transaction.reported_at,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
        }

        console.log("✅ [mapToGraphQLModelWithConversion] Final output:", {
            id: mapped.id,
            campaignPhaseId: mapped.campaignPhaseId,
            receiverId: mapped.receiverId,
        })

        return mapped
    }
}
