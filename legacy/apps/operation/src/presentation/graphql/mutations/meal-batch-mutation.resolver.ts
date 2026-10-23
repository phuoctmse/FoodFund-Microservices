import {
    CreateMealBatchInput,
    GenerateMealBatchMediaUploadUrlsInput,
    UpdateMealBatchStatusInput,
} from "@app/operation/src/application/dtos"
import { MealBatchMediaUploadResponse } from "@app/operation/src/application/dtos/meal-batch/response"
import { MealBatchService } from "@app/operation/src/application/services/meal-batch/meal-batch.service"
import { MealBatch } from "@app/operation/src/domain/entities"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => MealBatch)
export class MealBatchMutationResolver {
    constructor(private readonly mealBatchService: MealBatchService) {}

    @Mutation(() => MealBatchMediaUploadResponse, {
        description:
            "Generate pre-signed URLs for uploading meal batch media (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async generateMealBatchMediaUploadUrls(
        @Args("input") input: GenerateMealBatchMediaUploadUrlsInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<MealBatchMediaUploadResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.mealBatchService.generateMediaUploadUrls(
            input,
            userContext,
        )
    }

    @Mutation(() => MealBatch, {
        description:
            "Create meal batch with uploaded media and ingredient usages (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createMealBatch(
        @Args("input") input: CreateMealBatchInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<MealBatch> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.mealBatchService.createMealBatch(input, userContext)
    }

    @Mutation(() => MealBatch, {
        description:
            "Update meal batch status (Kitchen Staff: PREPARING → READY)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateMealBatchStatus(
        @Args("id", { type: () => String }) id: string,
        @Args("input") input: UpdateMealBatchStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<MealBatch> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.mealBatchService.updateMealBatchStatus(
            id,
            input,
            userContext,
        )
    }
}
