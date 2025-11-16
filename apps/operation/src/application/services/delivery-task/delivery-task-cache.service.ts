import { Injectable } from "@nestjs/common"
import { DeliveryTaskFilterInput } from "../../dtos/delivery-task"
import { RedisService } from "@libs/redis"
import { DeliveryTask } from "@app/operation/src/domain"
import { createHash } from "crypto"

export interface DeliveryTaskListCacheKey {
    filter?: DeliveryTaskFilterInput
    limit: number
    offset: number
}

@Injectable()
export class DeliveryTaskCacheService {
    private readonly TTL = {
        SINGLE_TASK: 60 * 30,
        TASK_LIST: 60 * 15,
        MEAL_BATCH_TASKS: 60 * 30,
        STAFF_TASKS: 60 * 30,
        PHASE_TASKS: 60 * 30,
        CAMPAIGN_TASKS: 60 * 30,
        STATS: 60 * 10,
    }

    private readonly KEYS = {
        SINGLE: "delivery-task",
        LIST: "delivery-tasks:list",
        MEAL_BATCH: "delivery-tasks:meal-batch",
        STAFF: "delivery-tasks:staff",
        PHASE: "delivery-tasks:phase",
        CAMPAIGN: "delivery-tasks:campaign",
        STATS: "delivery-tasks:stats",
    }

    constructor(private readonly redis: RedisService) {}

    // ==================== Single Delivery Task ====================

    async getTask(id: string): Promise<DeliveryTask | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask
        }

        return null
    }

    async setTask(id: string, task: DeliveryTask): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(task), {
            ex: this.TTL.SINGLE_TASK,
        })
    }

    async deleteTask(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    // ==================== Task Lists ====================

    private generateListCacheKey(params: DeliveryTaskListCacheKey): string {
        const normalized = {
            filter: params.filter || {},
            limit: params.limit,
            offset: params.offset,
        }

        const hash = createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex")
            .substring(0, 16)

        return `${this.KEYS.LIST}:${hash}`
    }

    async getTaskList(
        params: DeliveryTaskListCacheKey,
    ): Promise<DeliveryTask[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask[]
        }

        return null
    }

    async setTaskList(
        params: DeliveryTaskListCacheKey,
        tasks: DeliveryTask[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(tasks), {
            ex: this.TTL.TASK_LIST,
        })
    }

    async deleteAllTaskLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Meal Batch Tasks ====================

    async getMealBatchTasks(
        mealBatchId: string,
    ): Promise<DeliveryTask[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.MEAL_BATCH}:${mealBatchId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask[]
        }

        return null
    }

    async setMealBatchTasks(
        mealBatchId: string,
        tasks: DeliveryTask[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.MEAL_BATCH}:${mealBatchId}`
        await this.redis.set(key, JSON.stringify(tasks), {
            ex: this.TTL.MEAL_BATCH_TASKS,
        })
    }

    async deleteMealBatchTasks(mealBatchId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.MEAL_BATCH}:${mealBatchId}`
        await this.redis.del(key)
    }

    // ==================== Staff Tasks ====================

    async getStaffTasks(
        deliveryStaffId: string,
        limit: number,
        offset: number,
    ): Promise<DeliveryTask[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.STAFF}:${deliveryStaffId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask[]
        }

        return null
    }

    async setStaffTasks(
        deliveryStaffId: string,
        limit: number,
        offset: number,
        tasks: DeliveryTask[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STAFF}:${deliveryStaffId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(tasks), {
            ex: this.TTL.STAFF_TASKS,
        })
    }

    async deleteStaffTasks(deliveryStaffId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.STAFF}:${deliveryStaffId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Phase Tasks ====================

    async getCampaignPhaseTasks(
        campaignPhaseId: string,
    ): Promise<DeliveryTask[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask[]
        }

        return null
    }

    async setCampaignPhaseTasks(
        campaignPhaseId: string,
        tasks: DeliveryTask[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        await this.redis.set(key, JSON.stringify(tasks), {
            ex: this.TTL.PHASE_TASKS,
        })
    }

    async deleteCampaignPhaseTasks(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        await this.redis.del(key)
    }

    // ==================== Campaign Tasks ====================

    async getCampaignTasks(campaignId: string): Promise<DeliveryTask[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as DeliveryTask[]
        }

        return null
    }

    async setCampaignTasks(
        campaignId: string,
        tasks: DeliveryTask[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.set(key, JSON.stringify(tasks), {
            ex: this.TTL.CAMPAIGN_TASKS,
        })
    }

    async deleteCampaignTasks(campaignId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.del(key)
    }

    // ==================== Statistics ====================

    async getPhaseStats(campaignPhaseId: string): Promise<any | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached)
        }

        return null
    }

    async setPhaseStats(campaignPhaseId: string, stats: any): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.STATS,
        })
    }

    async deletePhaseStats(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        await this.redis.del(key)
    }

    // ==================== Invalidation ====================

    async invalidateTask(
        taskId: string,
        mealBatchId?: string,
        deliveryStaffId?: string,
        campaignPhaseId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deleteTask(taskId),
            this.deleteAllTaskLists(),
        ]

        if (mealBatchId) {
            deleteOperations.push(this.deleteMealBatchTasks(mealBatchId))
        }

        if (deliveryStaffId) {
            deleteOperations.push(this.deleteStaffTasks(deliveryStaffId))
        }

        if (campaignPhaseId) {
            deleteOperations.push(
                this.deleteCampaignPhaseTasks(campaignPhaseId),
            )
            deleteOperations.push(this.deletePhaseStats(campaignPhaseId))
        }

        await Promise.all(deleteOperations)
    }

    async invalidateAll(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const patterns = [
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.MEAL_BATCH}:*`,
            `${this.KEYS.STAFF}:*`,
            `${this.KEYS.PHASE}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.STATS}:*`,
        ]

        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern)
            if (keys.length > 0) {
                await this.redis.del(keys)
            }
        }
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        const isAvailable = this.redis.isAvailable()

        if (!isAvailable) {
            return { available: false, keysCount: 0 }
        }

        const keys = await this.redis.keys("delivery-task*")
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}
