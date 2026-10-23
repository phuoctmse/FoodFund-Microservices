import { MealBatchFilterInput } from "@app/operation/src/application/dtos"
import { MealBatchService } from "@app/operation/src/application/services/meal-batch/meal-batch.service"
import { MealBatch } from "@app/operation/src/domain/entities"
import { Args, Query, Resolver, ResolveReference } from "@nestjs/graphql"

@Resolver(() => MealBatch)
export class MealBatchQueryResolver {
    constructor(private readonly mealBatchService: MealBatchService) {}

    @Query(() => MealBatch, {
        nullable: true,
        description: "Get meal batch by ID (Public access with validation)",
    })
    async getMealBatch(
        @Args("id", { type: () => String }) id: string,
    ): Promise<MealBatch | null> {
        return await this.mealBatchService.getMealBatchById(id)
    }

    @Query(() => [MealBatch], {
        description:
            "Get meal batches with filters (Public access with scope validation)",
    })
    async getMealBatches(
        @Args("filter", {
            type: () => MealBatchFilterInput,
            nullable: true,
        })
            filter: MealBatchFilterInput,
    ): Promise<MealBatch[]> {
        return await this.mealBatchService.getMealBatches(filter || {})
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<MealBatch | null> {
        return await this.mealBatchService.getMealBatchById(reference.id)
    }
}
