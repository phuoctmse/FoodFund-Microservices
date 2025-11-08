import { ExpenseProof } from "@app/operation/src/domain"
import {
    AuthorizationService,
    Role,
    UserContext,
} from "@app/operation/src/shared"
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import {
    CreateExpenseProofInput,
    GenerateExpenseProofUploadUrlsInput,
    UpdateExpenseProofStatusInput,
} from "../../dtos"
import {
    ExpenseProofRepository,
    IngredientRequestRepository,
} from "../../repositories"
import { SpacesUploadService } from "@libs/s3-storage"
import { SentryService } from "@libs/observability"
import { ExpenseProofFilterInput } from "../../dtos/expense-proof"
import { GrpcClientService } from "@libs/grpc"
import { ExpenseProofStatus } from "@app/operation/src/domain/enums"

@Injectable()
export class ExpenseProofService {
    constructor(
        private readonly expenseProofRepository: ExpenseProofRepository,
        private readonly ingredientRequestRepository: IngredientRequestRepository,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly sentryService: SentryService,
        private readonly authorizationService: AuthorizationService,
        private readonly grpcClient: GrpcClientService,
    ) {}

    async generateUploadUrls(
        input: GenerateExpenseProofUploadUrlsInput,
        userContext: UserContext,
    ): Promise<{
        success: boolean
        message: string
        uploadUrls: Array<{
            uploadUrl: string
            fileKey: string
            cdnUrl: string
            expiresAt: Date
            fileType: string
        }>
        instructions: string
    }> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "generate expense proof upload URLs",
        )

        try {
            const request = await this.ingredientRequestRepository.findById(
                input.requestId,
            )

            if (!request) {
                throw new NotFoundException(
                    `Ingredient request not found: ${input.requestId}`,
                )
            }

            if (request.status !== "APPROVED") {
                throw new BadRequestException(
                    `Can only upload proof for APPROVED requests. Current status: ${request.status}`,
                )
            }

            const existingProof =
                await this.expenseProofRepository.findLatestByRequestId(
                    input.requestId,
                )

            if (existingProof && existingProof.status === "APPROVED") {
                throw new BadRequestException(
                    "Cannot upload new proof - an APPROVED proof already exists for this request",
                )
            }

            if (input.fileCount !== input.fileTypes.length) {
                throw new BadRequestException(
                    "File count must match number of file types provided",
                )
            }

            const allowedTypes = ["jpg", "jpeg", "png", "mp4", "mov"]
            const invalidTypes = input.fileTypes.filter(
                (type) => !allowedTypes.includes(type.toLowerCase()),
            )

            if (invalidTypes.length > 0) {
                throw new BadRequestException(
                    `Invalid file types: ${invalidTypes.join(", ")}. Allowed: ${allowedTypes.join(", ")}`,
                )
            }

            const uploadResults =
                await this.spacesUploadService.generateBatchImageUploadUrls(
                    userContext.userId,
                    "expense-proofs",
                    input.fileCount,
                    input.fileTypes,
                    input.requestId,
                )

            return {
                success: true,
                message: "Upload URLs generated successfully",
                uploadUrls: uploadResults.map((result) => ({
                    uploadUrl: result.uploadUrl,
                    fileKey: result.fileKey,
                    cdnUrl: result.cdnUrl,
                    expiresAt: result.expiresAt,
                    fileType: result.fileType || "image",
                })),
                instructions:
                    "Upload your files (bill/receipts/ingredient photos) to the provided URLs within 5 minutes. Then call createExpenseProof with the fileKeys.",
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.generateUploadUrls",
                userId: userContext.userId,
                requestId: input.requestId,
            })
            throw error
        }
    }

    async createExpenseProof(
        input: CreateExpenseProofInput,
        userContext: UserContext,
    ): Promise<ExpenseProof> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "create expense proof",
        )

        try {
            const request = await this.ingredientRequestRepository.findById(
                input.requestId,
            )

            if (!request) {
                throw new NotFoundException(
                    `Ingredient request not found: ${input.requestId}`,
                )
            }

            if (request.status !== "APPROVED") {
                throw new BadRequestException(
                    `Can only create proof for APPROVED requests. Current status: ${request.status}`,
                )
            }

            const existingProof =
                await this.expenseProofRepository.findLatestByRequestId(
                    input.requestId,
                )

            if (existingProof && existingProof.status === "APPROVED") {
                throw new BadRequestException(
                    "Cannot create new proof - an APPROVED proof already exists for this request",
                )
            }

            const validation = await this.spacesUploadService.validateFileKeys(
                input.mediaFileKeys,
                userContext.userId,
                "expense-proofs",
            )

            if (!validation.valid) {
                throw new BadRequestException(
                    `Invalid file keys: ${validation.invalidKeys.join(", ")}`,
                )
            }

            const amount = BigInt(input.amount)
            if (amount <= 0) {
                throw new BadRequestException("Amount must be greater than 0")
            }

            const cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!
            const mediaUrls = input.mediaFileKeys.map(
                (key) => `${cdnEndpoint}/${key}`,
            )

            const proof = await this.expenseProofRepository.create({
                requestId: input.requestId,
                media: mediaUrls,
                amount,
            })

            return this.mapToGraphQLModel(proof)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.createExpenseProof",
                userId: userContext.userId,
                requestId: input.requestId,
            })
            throw error
        }
    }

    async updateExpenseProofStatus(
        id: string,
        input: UpdateExpenseProofStatusInput,
        userContext: UserContext,
    ): Promise<ExpenseProof> {
        this.authorizationService.requireAdmin(
            userContext,
            "update expense proof status",
        )

        try {
            const proof = await this.expenseProofRepository.findById(id)

            if (!proof) {
                throw new NotFoundException(`Expense proof not found: ${id}`)
            }

            if (proof.status === input.status) {
                throw new BadRequestException(
                    `Proof is already in ${input.status} status`,
                )
            }

            if (
                input.status === ExpenseProofStatus.REJECTED &&
                !input.adminNote
            ) {
                throw new BadRequestException(
                    "Admin note is required when rejecting a proof",
                )
            }

            const updatedProof = await this.expenseProofRepository.updateStatus(
                id,
                input.status,
                input.adminNote,
            )

            return this.mapToGraphQLModel(updatedProof)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.updateExpenseProofStatus",
                adminId: userContext.userId,
                proofId: id,
                newStatus: input.status,
            })
            throw error
        }
    }

    async getExpenseProof(id: string): Promise<ExpenseProof> {
        try {
            const proof = await this.expenseProofRepository.findById(id)

            if (!proof) {
                throw new NotFoundException(`Expense proof not found: ${id}`)
            }

            return this.mapToGraphQLModel(proof)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getExpenseProof",
                proofId: id,
            })
            throw error
        }
    }

    async getExpenseProofs(
        filter: ExpenseProofFilterInput,
        limit: number,
        offset: number,
        userContext: UserContext,
    ): Promise<ExpenseProof[]> {
        try {
            const proofs = await this.expenseProofRepository.findWithFilters(
                filter,
                limit,
                offset,
            )

            if (userContext.role === Role.FUNDRAISER) {
                const filteredProofs = await this.filterFundraiserProofs(
                    proofs,
                    userContext.userId,
                )
                return filteredProofs.map((proof) =>
                    this.mapToGraphQLModel(proof),
                )
            }

            return proofs.map((proof) => this.mapToGraphQLModel(proof))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getExpenseProofs",
                userId: userContext.userId,
                filter,
            })
            throw error
        }
    }

    async getMyExpenseProofs(
        requestId: string | undefined,
        userContext: UserContext,
    ): Promise<ExpenseProof[]> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "view organization expense proofs",
        )

        try {
            const requests =
                await this.ingredientRequestRepository.findByKitchenStaffOrganization(
                    userContext.userId,
                )

            const requestIds = requests.map((r) => r.id)

            if (requestId) {
                if (!requestIds.includes(requestId)) {
                    throw new ForbiddenException(
                        "You can only view proofs from your organization",
                    )
                }

                const proofs =
                    await this.expenseProofRepository.findByRequestId(requestId)
                return proofs.map((proof) => this.mapToGraphQLModel(proof))
            }

            const proofs =
                await this.expenseProofRepository.findByOrganizationRequests(
                    requestIds,
                )

            return proofs.map((proof) => this.mapToGraphQLModel(proof))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getMyExpenseProofs",
                userId: userContext.userId,
                requestId,
            })
            throw error
        }
    }

    async getExpenseProofStats(userContext: UserContext): Promise<{
        totalProofs: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    }> {
        this.authorizationService.requireAdmin(
            userContext,
            "view expense proof statistics",
        )

        try {
            return await this.expenseProofRepository.getStats()
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getExpenseProofStats",
            })
            throw error
        }
    }

    private async checkFundraiserCampaignOwnership(
        requestId: string,
        fundraiserId: string,
    ): Promise<boolean> {
        try {
            const request =
                await this.ingredientRequestRepository.findById(requestId)

            if (!request || !request.campaignPhaseId) {
                return false
            }

            const campaignId =
                await this.ingredientRequestRepository.getCampaignIdFromPhaseId(
                    request.campaignPhaseId,
                )

            if (!campaignId) {
                return false
            }

            const response = await this.grpcClient.callCampaignService<
                { id: string },
                {
                    success: boolean
                    campaign?: {
                        id: string
                        created_by: string
                    }
                    error?: string
                }
            >("GetCampaign", { id: campaignId }, { timeout: 5000, retries: 2 })

            if (!response.success || !response.campaign) {
                return false
            }

            return response.campaign.created_by === fundraiserId
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation:
                    "ExpenseProofService.checkFundraiserCampaignOwnership",
                requestId,
                fundraiserId,
            })
            return false
        }
    }

    private async filterFundraiserProofs(
        proofs: any[],
        fundraiserId: string,
    ): Promise<any[]> {
        const filteredProofs: any[] = []

        for (const proof of proofs) {
            const hasAccess = await this.checkFundraiserCampaignOwnership(
                proof.request_id,
                fundraiserId,
            )

            if (hasAccess) {
                filteredProofs.push(proof)
            }
        }

        return filteredProofs
    }

    private mapToGraphQLModel(proof: any): ExpenseProof {
        return {
            id: proof.id,
            requestId: proof.request_id,
            media: Array.isArray(proof.media) ? proof.media : [],
            amount: proof.amount.toString(),
            status: proof.status as ExpenseProofStatus,
            adminNote: proof.admin_note,
            changedStatusAt: proof.changed_status_at,
            created_at: proof.created_at,
            updated_at: proof.updated_at,
        }
    }
}
