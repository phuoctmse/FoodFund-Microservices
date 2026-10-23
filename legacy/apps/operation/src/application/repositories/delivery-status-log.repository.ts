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
}
