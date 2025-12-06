import { Injectable, NotFoundException } from "@nestjs/common"
import { SentryService } from "@libs/observability"
import { IngredientRequestItemRepository } from "../../repositories"
import { IngredientRequestItem } from "@app/operation/src/domain"

@Injectable()
export class IngredientRequestItemService {
    constructor(
        private readonly repository: IngredientRequestItemRepository,
        private readonly sentryService: SentryService,
    ) {}

    async getItemById(id: string): Promise<IngredientRequestItem> {
        try {
            const item = await this.repository.findById(id)

            if (!item) {
                throw new NotFoundException(
                    `Ingredient request item with ID ${id} not found`,
                )
            }

            return item
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getIngredientRequestItemById",
                itemId: id,
            })
            throw error
        }
    }

    async getItemsByRequestId(
        requestId: string,
    ): Promise<IngredientRequestItem[]> {
        try {
            return await this.repository.findByRequestId(requestId)
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getIngredientRequestItemsByRequestId",
                requestId,
            })
            throw error
        }
    }
}
