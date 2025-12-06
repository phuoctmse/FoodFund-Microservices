import { Injectable } from "@nestjs/common"
import { DeliveryTaskStatus } from "../../domain"
import { PrismaClient } from "../../generated/operation-client"

export interface CreateDeliveryStatusLogData {
    deliveryTaskId: string
    status: DeliveryTaskStatus
    changedBy: string
    note?: string
}

@Injectable()
export class DeliveryStatusLogRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateDeliveryStatusLogData) {
        return await this.prisma.delivery_Status_Log.create({
            data: {
                delivery_task_id: data.deliveryTaskId,
                status: data.status,
                changed_by: data.changedBy,
                note: data.note,
            },
        })
    }

    async findByDeliveryTaskId(deliveryTaskId: string) {
        return await this.prisma.delivery_Status_Log.findMany({
            where: { delivery_task_id: deliveryTaskId },
            orderBy: { created_at: "desc" },
        })
    }

    async findLatestByDeliveryTaskId(deliveryTaskId: string) {
        return await this.prisma.delivery_Status_Log.findFirst({
            where: { delivery_task_id: deliveryTaskId },
            orderBy: { created_at: "desc" },
        })
    }

    async countByStatus(status: DeliveryTaskStatus) {
        return await this.prisma.delivery_Status_Log.count({
            where: { status },
        })
    }

    async getStatusTimeline(deliveryTaskId: string) {
        const logs = await this.prisma.delivery_Status_Log.findMany({
            where: { delivery_task_id: deliveryTaskId },
            orderBy: { created_at: "asc" },
            select: {
                status: true,
                created_at: true,
                changed_by: true,
                note: true,
            },
        })

        return logs
    }
}
