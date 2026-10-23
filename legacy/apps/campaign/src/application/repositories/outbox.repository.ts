import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"
import { OutboxStatus } from "../../domain/enums/outbox/outbox.enum"

@Injectable()
export class OutBoxRepository {
    constructor(
        private readonly prisma: PrismaClient,
    ) { }

    async findPendingEvents(limit = 10) {
        return this.prisma.outboxEvent.findMany({
            where: {
                status: OutboxStatus.PENDING,
            },
            orderBy: {
                created_at: "asc",
            },
            take: limit,
        })
    }

    async updateStatus(id: string, status: OutboxStatus, errorLog?: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status,
                processed_at: status === OutboxStatus.COMPLETED ? new Date() : undefined,
                error_log: errorLog,
                retry_count: status === OutboxStatus.FAILED ? { increment: 1 } : undefined,
            },
        })
    }

    async incrementRetryCount(id: string, errorLog: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                retry_count: { increment: 1 },
                error_log: errorLog,
                // Có thể thêm logic: Nếu retry > 5 lần thì set FAILED
            },
        })
    }
}