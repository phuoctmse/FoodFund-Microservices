import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"

// Prisma entity type (matches DB schema with snake_case)
export interface SystemConfigEntity {
    key: string
    value: string
    description: string | null
    data_type: string
    updated_at: Date
}

@Injectable()
export class SystemConfigRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async findByKey(key: string): Promise<SystemConfigEntity | null> {
        return this.prisma.system_Config.findUnique({
            where: { key },
        })
    }

    async findAll(): Promise<SystemConfigEntity[]> {
        return this.prisma.system_Config.findMany({
            orderBy: { key: "asc" },
        })
    }

    async upsert(data: {
        key: string
        value: string
        description?: string
        dataType?: string
    }): Promise<SystemConfigEntity> {
        return this.prisma.system_Config.upsert({
            where: { key: data.key },
            update: {
                value: data.value,
                description: data.description,
                data_type: data.dataType || "STRING",
            },
            create: {
                key: data.key,
                value: data.value,
                description: data.description || null,
                data_type: data.dataType || "STRING",
            },
        })
    }

    async delete(key: string): Promise<SystemConfigEntity> {
        return this.prisma.system_Config.delete({
            where: { key },
        })
    }
}
