import { Injectable } from "@nestjs/common"
import { DeliveryTaskFilterInput } from "../../dtos/delivery-task"
import { RedisService } from "@libs/redis"
import { DeliveryTask } from "@app/operation/src/domain"
import { BaseCacheService } from "@app/operation/src/shared/services"

export interface DeliveryTaskListCacheKey {
    filter?: DeliveryTaskFilterInput
}

@Injectable()
export class DeliveryTaskCacheService extends BaseCacheService<DeliveryTask> {
    protected readonly TTL = {
        SINGLE_TASK: 60 * 30, // 30 minutes
        TASK_LIST: 60 * 15, // 15 minutes
        STAFF_TASKS: 60 * 30, // 30 minutes
        STATS: 60 * 10, // 10 minutes
    }

    protected readonly KEYS = {
        SINGLE: "delivery-task",
        LIST: "delivery-tasks:list",
        STAFF: "delivery-tasks:staff",
        STATS: "delivery-tasks:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Task ====================

    async getTask(id: string): Promise<DeliveryTask | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setTask(id: string, task: DeliveryTask): Promise<void> {
        return this.setSingle(this.KEYS.SINGLE, id, task, this.TTL.SINGLE_TASK)
    }

    async deleteTask(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Task Lists ====================

    async getTaskList(
        params: DeliveryTaskListCacheKey,
    ): Promise<DeliveryTask[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setTaskList(
        params: DeliveryTaskListCacheKey,
        tasks: DeliveryTask[],
    ): Promise<void> {
        return this.setList(this.KEYS.LIST, params, tasks, this.TTL.TASK_LIST)
    }

    async deleteAllTaskLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== Staff Tasks ====================

    async getStaffTasks(
        deliveryStaffId: string,
    ): Promise<DeliveryTask[] | null> {
        return this.getRelatedList(this.KEYS.STAFF, deliveryStaffId)
    }

    async setStaffTasks(
        deliveryStaffId: string,
        tasks: DeliveryTask[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.STAFF,
            deliveryStaffId,
            tasks,
            this.TTL.STAFF_TASKS,
        )
    }

    async deleteStaffTasks(deliveryStaffId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.STAFF, deliveryStaffId)
    }

    // ==================== Statistics ====================

    async getPhaseStats(campaignPhaseId: string): Promise<{
        totalTasks: number
        pendingCount: number
        acceptedCount: number
        rejectedCount: number
        outForDeliveryCount: number
        completedCount: number
        failedCount: number
        completionRate: number
        failureRate: number
    } | null> {
        return this.getStats(this.KEYS.STATS, `phase:${campaignPhaseId}`)
    }

    async setPhaseStats(
        campaignPhaseId: string,
        stats: {
            totalTasks: number
            pendingCount: number
            acceptedCount: number
            rejectedCount: number
            outForDeliveryCount: number
            completedCount: number
            failedCount: number
            completionRate: number
            failureRate: number
        },
    ): Promise<void> {
        return this.setStats(
            this.KEYS.STATS,
            stats,
            this.TTL.STATS,
            `phase:${campaignPhaseId}`,
        )
    }

    async deletePhaseStats(campaignPhaseId: string): Promise<void> {
        return this.deleteStats(this.KEYS.STATS, `phase:${campaignPhaseId}`)
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("delivery-task*")
    }
}
