import { SentryService } from "@libs/observability"
import { IngredientRequestItem } from "../../domain/entities"
import { PrismaClient } from "../../generated/operation-client"
import { Injectable } from "@nestjs/common"

@Injectable()
export class IngredientRequestItemRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async findById(id: string): Promise<IngredientRequestItem | null> {
        try {
            const item = await this.prisma.ingredient_Request_Item.findUnique({
                where: { id },
            })

            return item ? this.mapToGraphQLModel(item) : null
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestItemById",
                itemId: id,
            })
            throw error
        }
    }

    async findByIds(ids: string[]): Promise<IngredientRequestItem[]> {
        try {
            const items = await this.prisma.ingredient_Request_Item.findMany({
                where: {
                    id: {
                        in: ids,
                    },
                },
            })

            return items.map((item) => this.mapToGraphQLModel(item))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestItemsByIds",
                ids,
            })
            throw error
        }
    }

    async findByRequestId(requestId: string): Promise<IngredientRequestItem[]> {
        try {
            const items = await this.prisma.ingredient_Request_Item.findMany({
                where: { request_id: requestId },
            })

            return items.map((item) => this.mapToGraphQLModel(item))
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "findIngredientRequestItemsByRequestId",
                requestId,
            })
            throw error
        }
    }

    private mapToGraphQLModel(item: any): IngredientRequestItem {
        return {
            id: item.id,
            requestId: item.request_id,
            ingredientName: item.ingredient_name,
            quantity: item.quantity.toString(),
            estimatedUnitPrice: item.estimated_unit_price,
            estimatedTotalPrice: item.estimated_total_price,
            supplier: item.supplier,
        } as IngredientRequestItem
    }
}
