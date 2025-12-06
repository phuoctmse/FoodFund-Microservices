import { Injectable } from "@nestjs/common"
import { MealBatch, MealBatchIngredientUsage } from "../../domain/entities"
import { MealBatchStatus } from "../../domain/enums"
import { PrismaClient } from "../../generated/operation-client"

interface CreateMealBatchData {
    campaignPhaseId: string
    kitchenStaffId: string
    foodName: string
    quantity: number
    media: string[]
    status: MealBatchStatus
    ingredientIds: string[]
}

@Injectable()
export class MealBatchRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateMealBatchData): Promise<MealBatch> {
        const mealBatch = await this.prisma.$transaction(async (tx) => {
            const batch = await tx.meal_Batch.create({
                data: {
                    campaign_phase_id: data.campaignPhaseId,
                    kitchen_staff_id: data.kitchenStaffId,
                    food_name: data.foodName,
                    quantity: data.quantity,
                    media: data.media,
                    status: data.status,
                    cooked_date: new Date(),
                },
            })

            await tx.meal_Batch_Ingredient_Usage.createMany({
                data: data.ingredientIds.map((ingredientId) => ({
                    meal_batch_id: batch.id,
                    ingredient_id: ingredientId,
                })),
            })

            return await tx.meal_Batch.findUnique({
                where: { id: batch.id },
                include: {
                    ingredient_usages: {
                        include: {
                            ingredient_item: {
                                include: {
                                    request: true,
                                },
                            },
                        },
                    },
                },
            })
        })

        return this.mapToGraphQLModel(mealBatch!)
    }

    async findById(id: string): Promise<MealBatch | null> {
        const batch = await this.prisma.meal_Batch.findUnique({
            where: { id },
            include: {
                ingredient_usages: {
                    include: {
                        ingredient_item: {
                            include: {
                                request: true,
                            },
                        },
                    },
                },
            },
        })

        return batch ? this.mapToGraphQLModel(batch) : null
    }

    async findWithFilters(filter: {
        campaignPhaseId?: string
        campaignPhaseIds?: string[]
        kitchenStaffId?: string
        status?: string
    }): Promise<MealBatch[]> {
        const where: any = {}

        if (filter.campaignPhaseIds && filter.campaignPhaseIds.length > 0) {
            where.campaign_phase_id = {
                in: filter.campaignPhaseIds,
            }
        } else if (filter.campaignPhaseId) {
            where.campaign_phase_id = filter.campaignPhaseId
        }

        if (filter.kitchenStaffId) {
            where.kitchen_staff_id = filter.kitchenStaffId
        }

        if (filter.status) {
            where.status = filter.status
        }

        const batches = await this.prisma.meal_Batch.findMany({
            where,
            include: {
                ingredient_usages: {
                    include: {
                        ingredient_item: {
                            include: {
                                request: true,
                            },
                        },
                    },
                },
            },
            orderBy: { created_at: "desc" },
        })

        return batches.map((batch) => this.mapToGraphQLModel(batch))
    }

    async updateStatus(
        id: string,
        status: MealBatchStatus,
        cookedDate?: Date,
    ): Promise<MealBatch> {
        const updateData: any = { status }

        if (cookedDate) {
            updateData.cooked_date = cookedDate
        }

        const batch = await this.prisma.meal_Batch.update({
            where: { id },
            data: updateData,
            include: {
                ingredient_usages: {
                    include: {
                        ingredient_item: {
                            include: {
                                request: true,
                            },
                        },
                    },
                },
            },
        })

        return this.mapToGraphQLModel(batch)
    }

    async updateStatusToDelivered(id: string): Promise<MealBatch> {
        const batch = await this.prisma.meal_Batch.update({
            where: { id },
            data: {
                status: MealBatchStatus.DELIVERED,
            },
            include: {
                ingredient_usages: {
                    include: {
                        ingredient_item: {
                            include: {
                                request: true,
                            },
                        },
                    },
                },
            },
        })

        return this.mapToGraphQLModel(batch)
    }

    private mapToGraphQLModel(batch: any): MealBatch {
        return {
            id: batch.id,
            campaignPhaseId: batch.campaign_phase_id,
            kitchenStaffId: batch.kitchen_staff_id,
            foodName: batch.food_name,
            quantity: batch.quantity,
            media: Array.isArray(batch.media) ? batch.media : [],
            status: batch.status as MealBatchStatus,
            cookedDate: batch.cooked_date,
            created_at: batch.created_at,
            updated_at: batch.updated_at,
            kitchenStaff: {
                __typename: "User",
                id: batch.kitchen_staff_id,
            },
            ingredientUsages: batch.ingredient_usages.map((usage: any) =>
                this.mapIngredientUsage(usage),
            ),
        } as MealBatch
    }

    private mapIngredientUsage(usage: any): MealBatchIngredientUsage {
        return {
            id: usage.id,
            mealBatchId: usage.meal_batch_id,
            ingredientId: usage.ingredient_id,
            ingredientItem: {
                id: usage.ingredient_item.id,
                requestId: usage.ingredient_item.request_id,
                ingredientName: usage.ingredient_item.ingredient_name,
                quantity: usage.ingredient_item.quantity,
                estimatedUnitPrice: usage.ingredient_item.estimated_unit_price,
                estimatedTotalPrice: usage.ingredient_item.estimated_total_price,
                supplier: usage.ingredient_item.supplier,
            },
        }
    }
}