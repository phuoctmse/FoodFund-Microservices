import { Injectable } from "@nestjs/common"
import { DeliveryTaskStatus } from "../../domain"
import { PrismaClient } from "../../generated/operation-client"

export interface CreateDeliveryTaskData {
    deliveryStaffId: string
    mealBatchId: string
    status: DeliveryTaskStatus
}

export interface UpdateDeliveryTaskStatusData {
    status: DeliveryTaskStatus
}

@Injectable()
export class DeliveryTaskRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateDeliveryTaskData) {
        return await this.prisma.delivery_Task.create({
            data: {
                delivery_staff_id: data.deliveryStaffId,
                meal_batch_id: data.mealBatchId,
                status: data.status,
            },
        })
    }

    async findById(id: string) {
        return await this.prisma.delivery_Task.findUnique({
            where: { id },
            include: {
                meal_batch: {
                    select: {
                        id: true,
                        campaign_phase_id: true,
                        kitchen_staff_id: true,
                        food_name: true,
                        quantity: true,
                        media: true,
                        status: true,
                        cooked_date: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
                status_logs: {
                    orderBy: { created_at: "desc" },
                },
            },
        })
    }

    async findByDeliveryStaffId(
        deliveryStaffId: string,
        limit: number,
        offset: number,
    ) {
        return await this.prisma.delivery_Task.findMany({
            where: { delivery_staff_id: deliveryStaffId },
            include: {
                meal_batch: {
                    select: {
                        id: true,
                        campaign_phase_id: true,
                        kitchen_staff_id: true,
                        planned_meal_id: true,
                        food_name: true,
                        quantity: true,
                        media: true,
                        status: true,
                        cooked_date: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
                status_logs: {
                    orderBy: { created_at: "desc" },
                },
            },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
        })
    }

    async findByMealBatchIds(
        mealBatchIds: string[],
        limit: number,
        offset: number,
    ) {
        return await this.prisma.delivery_Task.findMany({
            where: {
                meal_batch_id: {
                    in: mealBatchIds,
                },
            },
            include: {
                meal_batch: {
                    select: {
                        id: true,
                        campaign_phase_id: true,
                        kitchen_staff_id: true,
                        planned_meal_id: true,
                        food_name: true,
                        quantity: true,
                        media: true,
                        status: true,
                        cooked_date: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
                status_logs: {
                    orderBy: { created_at: "desc" },
                },
            },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
        })
    }

    async findByStaffAndMealBatch(
        deliveryStaffId: string,
        mealBatchId: string,
    ) {
        return await this.prisma.delivery_Task.findFirst({
            where: {
                delivery_staff_id: deliveryStaffId,
                meal_batch_id: mealBatchId,
            },
            include: {
                meal_batch: {
                    select: {
                        id: true,
                        campaign_phase_id: true,
                        kitchen_staff_id: true,
                        planned_meal_id: true,
                        food_name: true,
                        quantity: true,
                        media: true,
                        status: true,
                        cooked_date: true,
                        created_at: true,
                        updated_at: true,
                    },
                },
                status_logs: {
                    orderBy: { created_at: "desc" },
                },
            },
            orderBy: { created_at: "desc" },
        })
    }

    async updateStatus(id: string, data: UpdateDeliveryTaskStatusData) {
        return await this.prisma.delivery_Task.update({
            where: { id },
            data: {
                status: data.status,
            },
        })
    }

    async hasActiveTaskInPhase(
        deliveryStaffId: string,
        campaignPhaseId: string,
    ): Promise<boolean> {
        const mealBatches = await this.prisma.meal_Batch.findMany({
            where: { campaign_phase_id: campaignPhaseId },
            select: { id: true },
        })

        const mealBatchIds = mealBatches.map((mb) => mb.id)

        if (mealBatchIds.length === 0) {
            return false
        }

        const count = await this.prisma.delivery_Task.count({
            where: {
                delivery_staff_id: deliveryStaffId,
                meal_batch_id: { in: mealBatchIds },
                status: {
                    in: [
                        DeliveryTaskStatus.ACCEPTED,
                        DeliveryTaskStatus.OUT_FOR_DELIVERY,
                    ],
                },
            },
        })

        return count > 0
    }

    async hasTaskForMealBatch(
        deliveryStaffId: string,
        mealBatchId: string,
    ): Promise<boolean> {
        const count = await this.prisma.delivery_Task.count({
            where: {
                delivery_staff_id: deliveryStaffId,
                meal_batch_id: mealBatchId,
            },
        })

        return count > 0
    }

    async getStatsByMealBatchIds(mealBatchIds: string[]) {
        const [
            total,
            pending,
            accepted,
            rejected,
            outForDelivery,
            completed,
            failed,
        ] = await Promise.all([
            this.prisma.delivery_Task.count({
                where: { meal_batch_id: { in: mealBatchIds } },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.PENDING,
                },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.ACCEPTED,
                },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.REJECTED,
                },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.OUT_FOR_DELIVERY,
                },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.COMPLETED,
                },
            }),
            this.prisma.delivery_Task.count({
                where: {
                    meal_batch_id: { in: mealBatchIds },
                    status: DeliveryTaskStatus.FAILED,
                },
            }),
        ])

        const totalDelivered = completed + failed
        const completionRate =
            totalDelivered > 0 ? (completed / totalDelivered) * 100 : 0
        const failureRate =
            totalDelivered > 0 ? (failed / totalDelivered) * 100 : 0

        return {
            totalTasks: total,
            pendingCount: pending,
            acceptedCount: accepted,
            rejectedCount: rejected,
            outForDeliveryCount: outForDelivery,
            completedCount: completed,
            failedCount: failed,
            completionRate: Math.round(completionRate * 100) / 100,
            failureRate: Math.round(failureRate * 100) / 100,
        }
    }
}
