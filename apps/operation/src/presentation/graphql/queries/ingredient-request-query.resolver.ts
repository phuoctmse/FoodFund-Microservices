import { IngredientRequestFilterInput } from "@app/operation/src/application/dtos"
import { IngredientRequestService } from "@app/operation/src/application/services"
import { IngredientRequest } from "@app/operation/src/domain/entities"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => IngredientRequest)
export class IngredientRequestQueryResolver {
    constructor(
        private readonly ingredientRequestService: IngredientRequestService,
    ) {}

    @Query(() => IngredientRequest, {
        description: "Get ingredient request by ID",
        nullable: true,
    })
    async getIngredientRequest(
        @Args("id", { type: () => String, description: "Request ID" })
            id: string,
    ): Promise<IngredientRequest> {
        return this.ingredientRequestService.getRequestById(id)
    }

    @Query(() => [IngredientRequest], {
        description: "Get ingredient requests with filters and pagination",
    })
    async getIngredientRequests(
        @Args("filter", {
            type: () => IngredientRequestFilterInput,
            nullable: true,
        })
            filter?: IngredientRequestFilterInput,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of requests to return (default: 10)",
        })
            limit: number = 10,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of requests to skip (default: 0)",
        })
            offset: number = 0,
    ): Promise<IngredientRequest[]> {
        return this.ingredientRequestService.getRequests(filter, limit, offset)
    }

    @Query(() => [IngredientRequest], {
        description: "Get ingredient requests created by current kitchen staff",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyIngredientRequests(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
        })
            limit: number = 10,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
        })
            offset: number = 0,
    ): Promise<IngredientRequest[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.ingredientRequestService.getMyRequests(
            userContext,
            limit,
            offset,
        )
    }
}
