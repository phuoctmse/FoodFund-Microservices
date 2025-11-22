import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { v7 as uuidv7 } from "uuid"

export interface CreateBadgeInput {
    name: string
    description: string
    icon_url: string
    sort_order?: number
    is_active?: boolean
}

export interface UpdateBadgeInput {
    name?: string
    description?: string
    icon_url?: string
    sort_order?: number
    is_active?: boolean
}

@Injectable()
export class BadgeRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createBadge(data: CreateBadgeInput) {
        return this.prisma.badge.create({
            data: {
                id: uuidv7(),
                name: data.name,
                description: data.description,
                icon_url: data.icon_url,
                sort_order: data.sort_order,
                is_active: data.is_active,
            },
        })
    }

    async findAllBadges(includeInactive = false) {
        return this.prisma.badge.findMany({
            where: includeInactive ? {} : { is_active: true },
            orderBy: [{ sort_order: "asc" }, { created_at: "desc" }],
        })
    }

    async findBadgeById(id: string) {
        return this.prisma.badge.findUnique({
            where: { id },
        })
    }

    async updateBadge(id: string, data: UpdateBadgeInput) {
        return this.prisma.badge.update({
            where: { id },
            data,
        })
    }

    async deleteBadge(id: string) {
        return this.prisma.badge.delete({
            where: { id },
        })
    }

    async countBadges() {
        return this.prisma.badge.count()
    }

    async findBadgeBySortOrder(sortOrder: number, excludeId?: string) {
        return this.prisma.badge.findFirst({
            where: {
                sort_order: sortOrder,
                ...(excludeId && { id: { not: excludeId } }),
            },
        })
    }
}
