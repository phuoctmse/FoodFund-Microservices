import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { GrpcClientService } from "@libs/grpc"
import { CreateInflowTransactionInput } from "../../dtos"
import { PrismaClient } from "@app/operation/src/generated/operation-client"
import { IngredientRequestRepository, OperationRequestRepository } from "../../repositories"
import { IngredientRequestStatus, OperationRequestStatus } from "../../../domain/enums"

@Injectable()
export class InflowTransactionValidationService {
    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly prisma: PrismaClient,
        private readonly ingredientRequestRepo: IngredientRequestRepository,
        private readonly operationRequestRepo: OperationRequestRepository,
    ) {}

    private async validateIngredientRequest(ingredientRequestId: string) {
        const request = await this.ingredientRequestRepo.findById(ingredientRequestId)

        if (!request) {
            throw new NotFoundException(
                `Ingredient request with ID ${ingredientRequestId} not found`,
            )
        }

        if (request.status !== IngredientRequestStatus.APPROVED) {
            throw new BadRequestException(
                `Cannot disburse funds for ingredient request with status ${request.status}. ` +
                    "Only APPROVED requests can be disbursed.",
            )
        }

        return {
            request,
            campaignPhaseId: request.campaignPhaseId,
            totalCost: BigInt(request.totalCost),
        }
    }

    private async validateOperationRequest(operationRequestId: string) {
        const request = await this.operationRequestRepo.findById(operationRequestId)

        if (!request) {
            throw new NotFoundException(
                `Operation request with ID ${operationRequestId} not found`,
            )
        }

        if (request.status !== OperationRequestStatus.APPROVED) {
            throw new BadRequestException(
                `Cannot disburse funds for operation request with status ${request.status}. ` +
                    "Only APPROVED requests can be disbursed.",
            )
        }

        return {
            request,
            campaignPhaseId: request.campaign_phase_id,
            totalCost: request.total_cost,
            expenseType: request.expense_type, // COOKING or DELIVERY
        }
    }

    private async getFundraiserByPhaseId(phaseId: string): Promise<string> {
        const response = await this.grpcClient.callCampaignService<
            { phaseId: string },
            {
                success: boolean
                fundraiserId: string | null
                error: string | null
            }
        >("GetFundraiserByPhaseId", { phaseId })

        if (!response.success || !response.fundraiserId) {
            throw new NotFoundException(
                response.error ||
                    `Campaign phase ${phaseId} not found or has no fundraiser`,
            )
        }

        return response.fundraiserId
    }

    async validateCreateInput(input: CreateInflowTransactionInput) {
        // Validate amount is positive
        if (BigInt(input.amount) <= 0) {
            throw new BadRequestException("Amount must be greater than 0")
        }

        // Validate proof URL format
        if (!input.proof || input.proof.trim().length === 0) {
            throw new BadRequestException("Proof URL is required")
        }

        let campaignPhaseId: string
        let totalCost: bigint
        let transactionType: "INGREDIENT" | "COOKING" | "DELIVERY"

        // Validate based on request type
        if (input.ingredientRequestId) {
            const { request, campaignPhaseId: phaseId, totalCost: cost } = 
                await this.validateIngredientRequest(input.ingredientRequestId)
            
            campaignPhaseId = phaseId
            totalCost = cost
            transactionType = "INGREDIENT"

            // Verify amount matches ingredient request total cost
            if (BigInt(input.amount) !== totalCost) {
                throw new BadRequestException(
                    `Amount ${input.amount} does not match ingredient request total cost ${totalCost}`,
                )
            }
        } else {
            const { request, campaignPhaseId: phaseId, totalCost: cost, expenseType } = 
                await this.validateOperationRequest(input.operationRequestId!)
            
            campaignPhaseId = phaseId
            totalCost = cost
            transactionType = expenseType // COOKING or DELIVERY

            // Verify amount matches operation request total cost
            if (BigInt(input.amount) !== totalCost) {
                throw new BadRequestException(
                    `Amount ${input.amount} does not match operation request total cost ${totalCost}`,
                )
            }
        }

        // Get fundraiser ID from campaign phase
        const fundraiserId = await this.getFundraiserByPhaseId(campaignPhaseId)

        return {
            campaignPhaseId,
            fundraiserId,
            transactionType,
        }
    }

    async checkDuplicateDisbursement(
        ingredientRequestId?: string,
        operationRequestId?: string,
    ): Promise<boolean> {
        // Check if a disbursement already exists for this specific request
        const existing = await this.prisma.inflow_Transaction.findFirst({
            where: {
                OR: [
                    ingredientRequestId ? { ingredient_request_id: ingredientRequestId } : {},
                    operationRequestId ? { operation_request_id: operationRequestId } : {},
                ],
            },
        })

        return !!existing
    }
}
