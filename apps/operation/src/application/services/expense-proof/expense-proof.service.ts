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
    Logger,
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
import {
    ExpenseProofStatus,
    IngredientRequestStatus,
} from "@app/operation/src/domain/enums"
import { ExpenseProofCacheService } from "./expense-proof-cache.service"
import { BaseOperationService } from "@app/operation/src/shared/services"
import { BudgetValidationHelper } from "@app/operation/src/shared/helpers"
import { ExpenseProofSortOrder } from "@app/operation/src/domain/enums/expense-proof"
import { EventEmitter2 } from "@nestjs/event-emitter"

@Injectable()
export class ExpenseProofService extends BaseOperationService {
    private readonly logger = new Logger(ExpenseProofService.name)
    constructor(
        private readonly expenseProofRepository: ExpenseProofRepository,
        private readonly ingredientRequestRepository: IngredientRequestRepository,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly authorizationService: AuthorizationService,
        private readonly cacheService: ExpenseProofCacheService,
        private readonly eventEmitter: EventEmitter2,
        sentryService: SentryService,
        grpcClient: GrpcClientService,
    ) {
        super(sentryService, grpcClient)
    }

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

            BudgetValidationHelper.validateFileTypes(input.fileTypes)

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

            if (request.status !== "DISBURSED") {
                throw new BadRequestException(
                    `Can only create proof for DISBURSED requests. Current status: ${request.status}`,
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

            const amount = this.parseTotalCost(input.amount)

            const cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!
            const mediaUrls = input.mediaFileKeys.map(
                (key) => `${cdnEndpoint}/${key}`,
            )

            const proof = await this.expenseProofRepository.create({
                requestId: input.requestId,
                media: mediaUrls,
                amount,
            })

            const mappedProof = this.mapToGraphQLModel(proof)

            await Promise.all([
                this.cacheService.setProof(mappedProof.id, mappedProof),
                this.cacheService.deleteOrganizationProofs(userContext.userId),
                this.cacheService.deleteAllProofLists(),
                this.cacheService.deleteProofStats(),
            ])

            return mappedProof
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

            const mappedProof = this.mapToGraphQLModel(updatedProof)

            const request = proof.request
            const campaignPhase = await this.getCampaignPhaseDetails(
                request.campaign_phase_id,
            )
            if (input.status === ExpenseProofStatus.APPROVED) {
                this.eventEmitter.emit("expense-proof.approved", {
                    expenseProofId: id,
                    requestId: proof.request_id,
                    kitchenStaffId: request.kitchen_staff_id,
                    campaignTitle: campaignPhase.campaignTitle,
                    phaseName: campaignPhase.phaseName,
                    amount: proof.amount.toString(),
                    approvedAt: new Date().toISOString(),
                })
            } else if (input.status === ExpenseProofStatus.REJECTED) {
                this.eventEmitter.emit("expense-proof.rejected", {
                    expenseProofId: id,
                    requestId: proof.request_id,
                    kitchenStaffId: request.kitchen_staff_id,
                    campaignTitle: campaignPhase.campaignTitle,
                    phaseName: campaignPhase.phaseName,
                    amount: proof.amount.toString(),
                    adminNote: input.adminNote || "Không có ghi chú",
                    rejectedAt: new Date().toISOString(),
                })
            }

            await Promise.all([
                this.cacheService.setProof(mappedProof.id, mappedProof),
                this.cacheService.deleteAllProofLists(),
                this.cacheService.deleteProofStats(),
            ])

            return mappedProof
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
            let proof = await this.cacheService.getProof(id)

            if (!proof) {
                const dbProof = await this.expenseProofRepository.findById(id)

                if (!dbProof) {
                    throw new NotFoundException(
                        `Expense proof not found: ${id}`,
                    )
                }

                proof = this.mapToGraphQLModel(dbProof)
                await this.cacheService.setProof(id, proof)
            }

            return proof
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
    ): Promise<ExpenseProof[]> {
        try {
            const cacheKey = { filter, limit, offset }
            const cachedProofs = await this.cacheService.getProofList(cacheKey)

            if (cachedProofs) {
                return this.sortProofs(
                    cachedProofs,
                    filter.sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
                )
            }

            let proofs: any[]

            if (filter.campaignId && !filter.campaignPhaseId) {
                const campaignPhases = await this.getCampaignPhases(
                    filter.campaignId,
                )

                if (campaignPhases.length === 0) {
                    return []
                }

                const phaseIds = campaignPhases.map((phase) => phase.id)

                proofs =
                    await this.expenseProofRepository.findByMultipleCampaignPhases(
                        phaseIds,
                        filter.status,
                        limit,
                        offset,
                        filter.sortBy,
                    )
            } else {
                proofs = await this.expenseProofRepository.findWithFilters(
                    filter,
                    limit,
                    offset,
                )
            }

            const mappedProofs = proofs.map((proof) =>
                this.mapToGraphQLModel(proof),
            )

            const sortedProofs = this.sortProofs(
                mappedProofs,
                filter.sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setProofList(cacheKey, sortedProofs)

            return sortedProofs
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getExpenseProofs",
                filter,
            })
            throw error
        }
    }

    async getMyExpenseProofs(
        requestId: string | undefined,
        userContext: UserContext,
        sortBy?: ExpenseProofSortOrder,
    ): Promise<ExpenseProof[]> {
        this.authorizationService.requireRole(
            userContext,
            Role.KITCHEN_STAFF,
            "view organization expense proofs",
        )

        try {
            const cachedProofs = await this.cacheService.getOrganizationProofs(
                userContext.userId,
            )

            if (cachedProofs) {
                let filteredProofs = cachedProofs

                if (requestId) {
                    filteredProofs = cachedProofs.filter(
                        (proof) => proof.requestId === requestId,
                    )
                }

                return this.sortProofs(
                    filteredProofs,
                    sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
                )
            }

            const requests =
                await this.ingredientRequestRepository.findByKitchenStaffOrganization(
                    userContext.userId,
                )

            const requestIds = requests.map((r) => r.id)

            let proofs: any[]

            if (requestId) {
                if (!requestIds.includes(requestId)) {
                    throw new ForbiddenException(
                        "You can only view proofs from your organization",
                    )
                }

                proofs = await this.expenseProofRepository.findByRequestId(
                    requestId,
                    sortBy,
                )
            } else {
                proofs =
                    await this.expenseProofRepository.findByOrganizationRequests(
                        requestIds,
                        sortBy,
                    )
            }

            const mappedProofs = proofs.map((proof) =>
                this.mapToGraphQLModel(proof),
            )

            const sortedProofs = this.sortProofs(
                mappedProofs,
                sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
            )

            await this.cacheService.setOrganizationProofs(
                userContext.userId,
                sortedProofs,
            )

            return sortedProofs
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
            const cachedStats = await this.cacheService.getProofStats()

            if (cachedStats) {
                return cachedStats
            }

            const stats = await this.expenseProofRepository.getStats()

            await this.cacheService.setProofStats(stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "ExpenseProofService.getExpenseProofStats",
            })
            throw error
        }
    }

    private async getCampaignPhaseDetails(phaseId: string): Promise<{
        campaignTitle: string
        phaseName: string
    }> {
        try {
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
            >(
                "GetCampaignPhaseInfo",
                { phaseId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success || !response.phase) {
                this.logger.warn(
                    `Failed to get campaign phase details: ${response.error || "Phase not found"}`,
                )
                return {
                    campaignTitle: "Chiến dịch",
                    phaseName: "Giai đoạn",
                }
            }

            return {
                campaignTitle: response.phase.campaignTitle,
                phaseName: response.phase.phaseName,
            }
        } catch (error) {
            this.logger.warn(
                `Failed to get campaign phase details: ${error.message}`,
            )
            return {
                campaignTitle: "Chiến dịch",
                phaseName: "Giai đoạn",
            }
        }
    }

    private sortProofs(
        proofs: ExpenseProof[],
        sortBy: ExpenseProofSortOrder,
    ): ExpenseProof[] {
        const sorted = [...proofs]

        switch (sortBy) {
        case ExpenseProofSortOrder.OLDEST_FIRST:
            return sorted.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

        case ExpenseProofSortOrder.STATUS_PENDING_FIRST: {
            const pendingProofs = sorted.filter(
                (p) => p.status === ExpenseProofStatus.PENDING,
            )
            const approvedProofs = sorted.filter(
                (p) => p.status === ExpenseProofStatus.APPROVED,
            )
            const rejectedProofs = sorted.filter(
                (p) => p.status === ExpenseProofStatus.REJECTED,
            )

            pendingProofs.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
            )

            approvedProofs.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            rejectedProofs.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )

            return [...pendingProofs, ...approvedProofs, ...rejectedProofs]
        }

        case ExpenseProofSortOrder.NEWEST_FIRST:
        default:
            return sorted.sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
            )
        }
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
            request: proof.request
                ? {
                    id: proof.request.id,
                    campaignPhaseId: proof.request.campaign_phase_id,
                    kitchenStaffId: proof.request.kitchen_staff_id,
                    totalCost: proof.request.total_cost.toString(),
                    status: proof.request.status as IngredientRequestStatus,
                    changedStatusAt: proof.request.changed_status_at,
                    created_at: proof.request.created_at,
                    updated_at: proof.request.updated_at,
                    items:
                          proof.request.items?.map((item: any) => ({
                              id: item.id,
                              requestId: item.request_id,
                              ingredientName: item.ingredient_name,
                              quantity: item.quantity,
                              estimatedUnitPrice: item.estimated_unit_price,
                              estimatedTotalPrice: item.estimated_total_price,
                              supplier: item.supplier,
                          })) || [],
                    kitchenStaff: {
                        __typename: "User",
                        id: proof.request.kitchen_staff_id,
                    },
                    campaignPhase: {
                        __typename: "CampaignPhase",
                        id: proof.request.campaign_phase_id,
                    },
                }
                : undefined,
        }
    }
}
