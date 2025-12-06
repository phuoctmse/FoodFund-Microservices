import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import {
    InflowTransactionRepository,
    OperationRequestRepository,
} from "../../application/repositories"

interface HealthRequest {}

interface HealthResponse {
    status: string
    service: string
    timestamp: string
    uptime: number
}

interface GetOperationRequestStatusRequest {
    operationRequestId: string
}

interface GetOperationRequestStatusResponse {
    success: boolean
    operationRequest?: {
        id: string
        campaignPhaseId: string
        status: string
        createdAt: string
        updatedAt: string
    }
    error?: string
}

interface GetInflowTransactionByIdRequest {
    inflowTransactionId: string
}

interface GetInflowTransactionByIdResponse {
    success: boolean
    inflowTransaction?: {
        id: string
        campaignPhaseId: string
        receiverId: string
        amount: string
        transactionType: string
        status: string
        createdAt: string
    }
    error?: string
}

interface ValidateOperationRequestRequest {
    campaignPhaseId: string
    operationType: string
}

interface ValidateOperationRequestResponse {
    success: boolean
    isValid: boolean
    message: string
    error?: string
}

@Controller()
export class OperationGrpcController {
    private readonly logger = new Logger(OperationGrpcController.name)

    constructor(
        private readonly operationRequestRepository: OperationRequestRepository,
        private readonly inflowTransactionRepository: InflowTransactionRepository,
    ) {}

    @GrpcMethod("OperationService", "Health")
    async health(data: HealthRequest): Promise<HealthResponse> {
        return {
            status: "healthy",
            service: "operation-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }
    }

    // @GrpcMethod("OperationService", "GetOperationRequestStatus")
    // async getOperationRequestStatus(
    //     data: GetOperationRequestStatusRequest,
    // ): Promise<GetOperationRequestStatusResponse> {
    //     try {
    //         const { operationRequestId } = data

    //         if (!operationRequestId) {
    //             return {
    //                 success: false,
    //                 error: "Operation Request ID is required",
    //             }
    //         }

    //         this.logger.log(
    //             `[GetOperationRequestStatus] Fetching status for operation request: ${operationRequestId}`,
    //         )

    //         const operationRequest =
    //             await this.operationRequestRepository.findById(
    //                 operationRequestId,
    //             )

    //         if (!operationRequest) {
    //             return {
    //                 success: false,
    //                 error: "Operation request not found",
    //             }
    //         }

    //         return {
    //             success: true,
    //             operationRequest: {
    //                 id: operationRequest.id,
    //                 campaignPhaseId: operationRequest.campaign_phase_id,
    //                 status: operationRequest.status,
    //                 createdAt: operationRequest.created_at.toISOString(),
    //                 updatedAt: operationRequest.updated_at.toISOString(),
    //             },
    //         }
    //     } catch (error) {
    //         this.logger.error(
    //             "[GetOperationRequestStatus] Error:",
    //             error.stack || error,
    //         )
    //         return {
    //             success: false,
    //             error: error.message || "Failed to get operation request status",
    //         }
    //     }
    // }

    // @GrpcMethod("OperationService", "GetInflowTransactionById")
    // async getInflowTransactionById(
    //     data: GetInflowTransactionByIdRequest,
    // ): Promise<GetInflowTransactionByIdResponse> {
    //     try {
    //         const { inflowTransactionId } = data

    //         if (!inflowTransactionId) {
    //             return {
    //                 success: false,
    //                 error: "Inflow Transaction ID is required",
    //             }
    //         }

    //         this.logger.log(
    //             `[GetInflowTransactionById] Fetching inflow transaction: ${inflowTransactionId}`,
    //         )

    //         const inflowTransaction =
    //             await this.inflowTransactionRepository.findById(
    //                 inflowTransactionId,
    //             )

    //         if (!inflowTransaction) {
    //             return {
    //                 success: false,
    //                 error: "Inflow transaction not found",
    //             }
    //         }

    //         return {
    //             success: true,
    //             inflowTransaction: {
    //                 id: inflowTransaction.id,
    //                 campaignPhaseId: inflowTransaction.campaign_phase_id,
    //                 receiverId: inflowTransaction.receiver_id,
    //                 amount: inflowTransaction.amount.toString(),
    //                 transactionType: inflowTransaction.transaction_type,
    //                 status: inflowTransaction.status,
    //                 createdAt: inflowTransaction.created_at.toISOString(),
    //             },
    //         }
    //     } catch (error) {
    //         this.logger.error(
    //             "[GetInflowTransactionById] Error:",
    //             error.stack || error,
    //         )
    //         return {
    //             success: false,
    //             error:
    //                 error.message ||
    //                 "Failed to get inflow transaction by ID",
    //         }
    //     }
    // }

    // @GrpcMethod("OperationService", "ValidateOperationRequest")
    // async validateOperationRequest(
    //     data: ValidateOperationRequestRequest,
    // ): Promise<ValidateOperationRequestResponse> {
    //     try {
    //         const { campaignPhaseId, operationType } = data

    //         if (!campaignPhaseId || !operationType) {
    //             return {
    //                 success: false,
    //                 isValid: false,
    //                 message: "Campaign Phase ID and operation type are required",
    //             }
    //         }

    //         this.logger.log(
    //             `[ValidateOperationRequest] Validating operation for campaign phase: ${campaignPhaseId}, type: ${operationType}`,
    //         )

    //         // Basic validation logic - can be expanded based on business rules
    //         const count =
    //             await this.operationRequestRepository.countByCampaignPhaseId(
    //                 campaignPhaseId,
    //             )

    //         this.logger.log(
    //             `[ValidateOperationRequest] Found ${count} operations for campaign phase ${campaignPhaseId}`,
    //         )

    //         // Simple validation: always return valid for now
    //         // You can add more complex business rules here
    //         return {
    //             success: true,
    //             isValid: true,
    //             message: "Operation request is valid",
    //         }
    //     } catch (error) {
    //         this.logger.error(
    //             "[ValidateOperationRequest] Error:",
    //             error.stack || error,
    //         )
    //         return {
    //             success: false,
    //             isValid: false,
    //             message: error.message || "Failed to validate operation request",
    //         }
    //     }
    // }
}

