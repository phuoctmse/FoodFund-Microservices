import {
    DeliveryStatusLog,
    DeliveryTask,
    DeliveryTaskStatus,
    MealBatchStatus,
} from "@app/operation/src/domain"
import {
    CreateDeliveryStatusLogData,
    CreateDeliveryTaskData,
    DeliveryStatusLogRepository,
    DeliveryTaskRepository,
    MealBatchRepository,
    UpdateDeliveryTaskStatusData,
} from "../../repositories"
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import {
    AuthorizationService,
    Role,
    UserContext,
} from "@app/operation/src/shared"
import {
    AssignTaskToStaffInput,
    DeliveryTaskFilterInput,
    DeliveryTaskStatsResponse,
    SelfAssignTaskInput,
    UpdateDeliveryTaskStatusInput,
} from "../../dtos/delivery-task"
import { SentryService } from "@libs/observability"
import { GrpcClientService } from "@libs/grpc"
import { DeliveryTaskCacheService } from "./delivery-task-cache.service"
import { MealBatchCacheService } from "../meal-batch"
import { BaseOperationService } from "@app/operation/src/shared/services"

@Injectable()
export class DeliveryTaskService extends BaseOperationService {
    constructor(
        private readonly deliveryTaskRepository: DeliveryTaskRepository,
        private readonly deliveryStatusLogRepository: DeliveryStatusLogRepository,
        private readonly mealBatchRepository: MealBatchRepository,
        private readonly authService: AuthorizationService,
        private readonly cacheService: DeliveryTaskCacheService,
        private readonly mealBatchCacheService: MealBatchCacheService,
        sentryService: SentryService,
        grpcClient: GrpcClientService,
    ) {
        super(sentryService, grpcClient)
    }

    async assignTaskToStaff(
        input: AssignTaskToStaffInput,
        userContext: UserContext,
    ): Promise<DeliveryTask[]> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "assign delivery task",
            )
            this.authService.requireRole(
                userContext,
                Role.FUNDRAISER,
                "assign delivery task",
            )

            const mealBatch = await this.mealBatchRepository.findById(
                input.mealBatchId,
            )

            if (!mealBatch) {
                throw new NotFoundException(
                    `Meal batch with ID ${input.mealBatchId} not found`,
                )
            }

            if (mealBatch.status !== MealBatchStatus.READY) {
                throw new BadRequestException(
                    `Meal batch must have READY status. Current status: ${mealBatch.status}`,
                )
            }

            const fundraiserOrganization = await this.getFundraiserOrganization(
                userContext.userId,
            )

            if (!fundraiserOrganization) {
                throw new BadRequestException(
                    "You must belong to an organization to assign delivery tasks",
                )
            }

            const validationResults = await Promise.all(
                input.deliveryStaffIds.map(async (staffId) => {
                    const staffInfo = await this.verifyDeliveryStaff(staffId)

                    if (
                        staffInfo.organizationId !== fundraiserOrganization.id
                    ) {
                        throw new BadRequestException(
                            `Cannot assign task to delivery staff ${staffId}. ` +
                                `Staff belongs to organization "${staffInfo.organizationName}" ` +
                                `but you manage organization "${fundraiserOrganization.name}". ` +
                                "You can only assign tasks to staff from your own organization.",
                        )
                    }

                    const hasActiveTask =
                        await this.deliveryTaskRepository.hasActiveTaskInPhase(
                            staffId,
                            mealBatch.campaignPhaseId,
                        )

                    return {
                        staffId,
                        hasActiveTask,
                        organizationId: staffInfo.organizationId,
                    }
                }),
            )

            const conflictingStaff = validationResults
                .filter((r) => r.hasActiveTask)
                .map((r) => r.staffId)

            if (conflictingStaff.length > 0) {
                throw new BadRequestException(
                    `Cannot assign task. The following staff have active tasks (ACCEPTED or OUT_FOR_DELIVERY) in this campaign phase: ${conflictingStaff.join(", ")}`,
                )
            }

            const createdTasks: DeliveryTask[] = []

            for (const staffId of input.deliveryStaffIds) {
                const createData: CreateDeliveryTaskData = {
                    deliveryStaffId: staffId,
                    mealBatchId: input.mealBatchId,
                    status: DeliveryTaskStatus.PENDING,
                }

                const created =
                    await this.deliveryTaskRepository.create(createData)

                await this.createStatusLog({
                    deliveryTaskId: created.id,
                    status: DeliveryTaskStatus.PENDING,
                    changedBy: userContext.userId,
                    note: `Task assigned by fundraiser to delivery staff ${staffId}`,
                })

                const mappedTask = this.mapToGraphQLModel(created)
                await this.cacheService.setTask(mappedTask.id, mappedTask)

                createdTasks.push(mappedTask)
            }

            await Promise.all([
                this.cacheService.deleteMealBatchTasks(input.mealBatchId),
                this.cacheService.deleteCampaignPhaseTasks(
                    mealBatch.campaignPhaseId,
                ),
                this.cacheService.deleteAllTaskLists(),
                ...input.deliveryStaffIds.map((staffId) =>
                    this.cacheService.deleteStaffTasks(staffId),
                ),
            ])

            return createdTasks
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.assignTaskToStaff",
                input,
                userId: userContext.userId,
            })
            throw error
        }
    }

    async selfAssignTask(
        input: SelfAssignTaskInput,
        userContext: UserContext,
    ): Promise<DeliveryTask> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "self-assign delivery task",
            )
            this.authService.requireRole(
                userContext,
                Role.DELIVERY_STAFF,
                "self-assign delivery task",
            )

            const mealBatch = await this.mealBatchRepository.findById(
                input.mealBatchId,
            )

            if (!mealBatch) {
                throw new NotFoundException(
                    `Meal batch with ID ${input.mealBatchId} not found`,
                )
            }

            if (mealBatch.status !== MealBatchStatus.READY) {
                throw new BadRequestException(
                    `Meal batch must have READY status. Current status: ${mealBatch.status}`,
                )
            }

            const createData: CreateDeliveryTaskData = {
                deliveryStaffId: userContext.userId,
                mealBatchId: input.mealBatchId,
                status: DeliveryTaskStatus.ACCEPTED,
            }

            const created = await this.deliveryTaskRepository.create(createData)

            await this.createStatusLog({
                deliveryTaskId: created.id,
                status: DeliveryTaskStatus.ACCEPTED,
                changedBy: userContext.userId,
                note: "Task self-assigned by delivery staff",
            })

            const mappedTask = this.mapToGraphQLModel(created)

            await Promise.all([
                this.cacheService.setTask(mappedTask.id, mappedTask),
                this.cacheService.deleteMealBatchTasks(input.mealBatchId),
                this.cacheService.deleteStaffTasks(userContext.userId),
                this.cacheService.deleteCampaignPhaseTasks(
                    mealBatch.campaignPhaseId,
                ),
                this.cacheService.deleteAllTaskLists(),
            ])

            return mappedTask
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.selfAssignTask",
                input,
                userId: userContext.userId,
            })
            throw error
        }
    }

    async updateTaskStatus(
        input: UpdateDeliveryTaskStatusInput,
        userContext: UserContext,
    ): Promise<DeliveryTask> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "update delivery task status",
            )

            const task = await this.deliveryTaskRepository.findById(
                input.taskId,
            )

            if (!task) {
                throw new NotFoundException(
                    `Delivery task with ID ${input.taskId} not found`,
                )
            }

            this.validateStatusTransition(
                task.status as DeliveryTaskStatus,
                input.status,
            )

            this.checkStatusChangeAuthorization(task, input.status, userContext)

            if (
                (input.status === DeliveryTaskStatus.FAILED ||
                    input.status === DeliveryTaskStatus.REJECTED) &&
                !input.note?.trim()
            ) {
                throw new BadRequestException(
                    `Note is required when marking task as ${input.status}`,
                )
            }

            const mealBatch = await this.mealBatchRepository.findById(
                task.meal_batch_id,
            )

            if (!mealBatch) {
                throw new NotFoundException(
                    `Meal batch ${task.meal_batch_id} not found`,
                )
            }

            if (input.status === DeliveryTaskStatus.OUT_FOR_DELIVERY) {
                await this.mealBatchRepository.updateStatusToDelivered(
                    task.meal_batch_id,
                )
            }

            const updateData: UpdateDeliveryTaskStatusData = {
                status: input.status,
            }

            const updated = await this.deliveryTaskRepository.updateStatus(
                input.taskId,
                updateData,
            )

            await this.createStatusLog({
                deliveryTaskId: input.taskId,
                status: input.status,
                changedBy: userContext.userId,
                note: input.note,
            })

            const mappedTask = this.mapToGraphQLModel(updated)

            await Promise.all([
                this.cacheService.setTask(mappedTask.id, mappedTask),
                this.cacheService.deleteMealBatchTasks(task.meal_batch_id),
                this.cacheService.deleteStaffTasks(task.delivery_staff_id),
                this.cacheService.deleteCampaignPhaseTasks(
                    mealBatch.campaignPhaseId,
                ),
                this.cacheService.deletePhaseStats(mealBatch.campaignPhaseId),
                this.cacheService.deleteAllTaskLists(),

                this.mealBatchCacheService.invalidateBatch(
                    task.meal_batch_id,
                    mealBatch.campaignPhaseId,
                    mealBatch.kitchenStaffId,
                ),
            ])

            return mappedTask
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.updateTaskStatus",
                input,
                userId: userContext.userId,
            })
            throw error
        }
    }

    async getTasks(filter: DeliveryTaskFilterInput): Promise<DeliveryTask[]> {
        try {
            const cacheKey = {
                filter,
                limit: filter.limit || 10,
                offset: filter.offset || 0,
            }

            const cachedTasks = await this.cacheService.getTaskList(cacheKey)

            if (cachedTasks) {
                return cachedTasks
            }

            const mealBatchIds = await this.resolveMealBatchIds(filter)

            if (mealBatchIds.length === 0) {
                return []
            }

            const tasks = await this.deliveryTaskRepository.findByMealBatchIds(
                mealBatchIds,
                filter.limit,
                filter.offset,
            )

            const mappedTasks = tasks.map((t) => this.mapToGraphQLModel(t))

            await this.cacheService.setTaskList(cacheKey, mappedTasks)

            return mappedTasks
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getTasks",
                filter,
            })
            throw error
        }
    }

    async getTaskById(id: string): Promise<DeliveryTask> {
        try {
            let task = await this.cacheService.getTask(id)

            if (!task) {
                const dbTask = await this.deliveryTaskRepository.findById(id)

                if (!dbTask) {
                    throw new NotFoundException(
                        `Delivery task with ID ${id} not found`,
                    )
                }

                task = this.mapToGraphQLModel(dbTask)

                await this.cacheService.setTask(id, task)
            }

            return task
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getTaskById",
                taskId: id,
            })
            throw error
        }
    }

    async getMyTasks(
        userContext: UserContext,
        limit = 10,
        offset = 0,
    ): Promise<DeliveryTask[]> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "view your delivery tasks",
            )

            this.authService.requireRole(
                userContext,
                Role.DELIVERY_STAFF,
                "view your delivery tasks",
            )

            const cachedTasks = await this.cacheService.getStaffTasks(
                userContext.userId,
            )

            if (cachedTasks) {
                return cachedTasks
            }

            const tasks =
                await this.deliveryTaskRepository.findByDeliveryStaffId(
                    userContext.userId,
                    limit,
                    offset,
                )

            const mappedTasks = tasks.map((t) => this.mapToGraphQLModel(t))

            await this.cacheService.setStaffTasks(
                userContext.userId,
                mappedTasks,
            )

            return mappedTasks
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getMyTasks",
                userId: userContext.userId,
            })
            throw error
        }
    }

    async getTasksByMealBatch(
        mealBatchId: string,
        userContext: UserContext,
    ): Promise<DeliveryTask[]> {
        try {
            this.authService.requireAuthentication(
                userContext,
                "view delivery tasks for meal batch",
            )

            const cachedTasks =
                await this.cacheService.getMealBatchTasks(mealBatchId)

            if (cachedTasks) {
                return cachedTasks
            }

            const tasks =
                await this.deliveryTaskRepository.findByMealBatchId(mealBatchId)

            const mappedTasks = tasks.map((t) => this.mapToGraphQLModel(t))

            await this.cacheService.setMealBatchTasks(mealBatchId, mappedTasks)

            return mappedTasks
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getTasksByMealBatch",
                mealBatchId,
            })
            throw error
        }
    }

    async getStatsByCampaignPhase(
        campaignPhaseId: string,
    ): Promise<DeliveryTaskStatsResponse> {
        try {
            const cachedStats =
                await this.cacheService.getPhaseStats(campaignPhaseId)

            if (cachedStats) {
                return cachedStats
            }

            const mealBatches = await this.mealBatchRepository.findWithFilters({
                campaignPhaseId,
            })

            const mealBatchIds = mealBatches.map((mb) => mb.id)

            if (mealBatchIds.length === 0) {
                return {
                    totalTasks: 0,
                    pendingCount: 0,
                    acceptedCount: 0,
                    rejectedCount: 0,
                    outForDeliveryCount: 0,
                    completedCount: 0,
                    failedCount: 0,
                    completionRate: 0,
                    failureRate: 0,
                }
            }

            const stats =
                await this.deliveryTaskRepository.getStatsByMealBatchIds(
                    mealBatchIds,
                )

            await this.cacheService.setPhaseStats(campaignPhaseId, stats)

            return stats
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getStatsByCampaignPhase",
                campaignPhaseId,
            })
            throw error
        }
    }

    async getStatusLogs(taskId: string): Promise<DeliveryStatusLog[]> {
        try {
            const logs =
                await this.deliveryStatusLogRepository.findByDeliveryTaskId(
                    taskId,
                )

            return logs.map((log) => this.mapStatusLogToGraphQLModel(log))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.getStatusLogs",
                taskId,
            })
            throw error
        }
    }

    // ==================== Private Helper Methods ====================

    private async resolveMealBatchIds(
        filter: DeliveryTaskFilterInput,
    ): Promise<string[]> {
        if (filter.mealBatchId) {
            return [filter.mealBatchId]
        }

        if (filter.campaignId) {
            return this.getMealBatchIdsByCampaignId(filter.campaignId)
        }

        if (filter.campaignPhaseId) {
            return this.getMealBatchIdsByCampaignPhaseId(filter.campaignPhaseId)
        }

        return []
    }

    private async getMealBatchIdsByCampaignId(
        campaignId: string,
    ): Promise<string[]> {
        const campaignPhases = await this.getCampaignPhases(campaignId)

        if (campaignPhases.length === 0) {
            this.sentryService.addBreadcrumb(
                "No campaign phases found for campaign",
                "warning",
                { campaignId },
            )
            return []
        }

        const phaseIds = campaignPhases.map((phase) => phase.id)

        const mealBatches = await this.mealBatchRepository.findWithFilters({
            campaignPhaseIds: phaseIds,
        })

        return mealBatches.map((mb) => mb.id)
    }

    private async getMealBatchIdsByCampaignPhaseId(
        campaignPhaseId: string,
    ): Promise<string[]> {
        const mealBatches = await this.mealBatchRepository.findWithFilters({
            campaignPhaseId,
        })

        return mealBatches.map((mb) => mb.id)
    }

    private validateStatusTransition(
        currentStatus: DeliveryTaskStatus,
        newStatus: DeliveryTaskStatus,
    ): void {
        const validTransitions: Record<
            DeliveryTaskStatus,
            DeliveryTaskStatus[]
        > = {
            [DeliveryTaskStatus.PENDING]: [
                DeliveryTaskStatus.ACCEPTED,
                DeliveryTaskStatus.REJECTED,
            ],
            [DeliveryTaskStatus.ACCEPTED]: [
                DeliveryTaskStatus.OUT_FOR_DELIVERY,
            ],
            [DeliveryTaskStatus.REJECTED]: [],
            [DeliveryTaskStatus.OUT_FOR_DELIVERY]: [
                DeliveryTaskStatus.COMPLETED,
                DeliveryTaskStatus.FAILED,
            ],
            [DeliveryTaskStatus.COMPLETED]: [],
            [DeliveryTaskStatus.FAILED]: [],
        }

        const allowed = validTransitions[currentStatus] || []

        if (!allowed.includes(newStatus)) {
            throw new BadRequestException(
                `Cannot transition from ${currentStatus} to ${newStatus}. ` +
                    `Allowed transitions: ${allowed.length > 0 ? allowed.join(", ") : "none"}`,
            )
        }
    }

    private async getFundraiserOrganization(
        fundraiserId: string,
    ): Promise<{ id: string; name: string } | null> {
        const response = await this.grpcClient.callUserService<
            { userId: string },
            {
                success: boolean
                organization?: {
                    id: string
                    name: string
                }
                error?: string
            }
        >(
            "GetUserOrganization",
            { userId: fundraiserId },
            { timeout: 5000, retries: 2 },
        )

        if (!response.success || !response.organization) {
            return null
        }

        return response.organization
    }

    private async verifyDeliveryStaff(deliveryStaffId: string): Promise<{
        userId: string
        role: string
        organizationId: string | null
        organizationName: string | null
    }> {
        try {
            const response = await this.grpcClient.callUserService<
                { userId: string },
                {
                    success: boolean
                    user?: {
                        id: string
                        role: string
                        organizationId?: string | null
                        organizationName?: string | null
                    }
                    error?: string
                }
            >(
                "GetUserBasicInfo",
                { userId: deliveryStaffId },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success || !response.user) {
                throw new BadRequestException(
                    response.error ||
                        `Delivery staff ${deliveryStaffId} not found`,
                )
            }

            if (response.user.role !== Role.DELIVERY_STAFF) {
                throw new BadRequestException(
                    `User ${deliveryStaffId} is not a delivery staff. Role: ${response.user.role}`,
                )
            }

            if (!response.user.organizationId) {
                throw new BadRequestException(
                    `Delivery staff ${deliveryStaffId} does not belong to any organization`,
                )
            }

            return {
                userId: response.user.id,
                role: response.user.role,
                organizationId: response.user.organizationId,
                organizationName:
                    response.user.organizationName || "Unknown Organization",
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error
            }
            this.sentryService.captureError(error as Error, {
                operation: "DeliveryTaskService.verifyDeliveryStaff",
                deliveryStaffId,
            })
            throw new BadRequestException(
                "Failed to verify delivery staff. Please try again.",
            )
        }
    }

    private checkStatusChangeAuthorization(
        task: any,
        newStatus: DeliveryTaskStatus,
        userContext: UserContext,
    ): void {
        const currentStatus = task.status as DeliveryTaskStatus

        if (currentStatus === DeliveryTaskStatus.PENDING) {
            if (task.delivery_staff_id !== userContext.userId) {
                throw new ForbiddenException(
                    "Only the assigned delivery staff can accept or reject this task",
                )
            }
        }

        if (
            currentStatus === DeliveryTaskStatus.ACCEPTED &&
            newStatus === DeliveryTaskStatus.OUT_FOR_DELIVERY
        ) {
            if (task.delivery_staff_id !== userContext.userId) {
                throw new ForbiddenException(
                    "Only the assigned delivery staff can start delivery",
                )
            }
        }

        if (currentStatus === DeliveryTaskStatus.OUT_FOR_DELIVERY) {
            const isAssignedStaff =
                task.delivery_staff_id === userContext.userId
            const isFundraiser = userContext.role === Role.FUNDRAISER

            if (!isAssignedStaff && !isFundraiser) {
                throw new ForbiddenException(
                    "Only the assigned delivery staff or fundraiser can complete or mark as failed",
                )
            }
        }
    }

    private async createStatusLog(
        data: CreateDeliveryStatusLogData,
    ): Promise<void> {
        await this.deliveryStatusLogRepository.create(data)
    }

    private mapToGraphQLModel(data: any): DeliveryTask {
        return {
            id: data.id,
            deliveryStaffId: data.delivery_staff_id,
            mealBatchId: data.meal_batch_id,
            status: data.status as DeliveryTaskStatus,
            created_at: data.created_at,
            updated_at: data.updated_at,
            deliveryStaff: {
                __typename: "User",
                id: data.delivery_staff_id,
            },
            mealBatch: data.meal_batch
                ? {
                    id: data.meal_batch.id,
                    campaignPhaseId: data.meal_batch.campaign_phase_id,
                    kitchenStaffId: data.meal_batch.kitchen_staff_id,
                    foodName: data.meal_batch.food_name,
                    quantity: data.meal_batch.quantity,
                    media: Array.isArray(data.meal_batch.media)
                        ? data.meal_batch.media
                        : [],
                    status: data.meal_batch.status as MealBatchStatus,
                    cookedDate: data.meal_batch.cooked_date,
                    created_at: data.meal_batch.created_at,
                    updated_at: data.meal_batch.updated_at,
                    kitchenStaff: {
                        __typename: "User",
                        id: data.meal_batch.kitchen_staff_id,
                    },
                    ingredientUsages: [],
                }
                : undefined,
            statusLogs: data.status_logs
                ? data.status_logs.map((log: any) =>
                    this.mapStatusLogToGraphQLModel(log),
                )
                : undefined,
        }
    }

    private mapStatusLogToGraphQLModel(data: any): DeliveryStatusLog {
        return {
            id: data.id,
            deliveryTaskId: data.delivery_task_id,
            status: data.status as DeliveryTaskStatus,
            changedBy: data.changed_by,
            note: data.note,
            createdAt: data.created_at,
            user: {
                __typename: "User",
                id: data.changed_by,
            },
        }
    }
}