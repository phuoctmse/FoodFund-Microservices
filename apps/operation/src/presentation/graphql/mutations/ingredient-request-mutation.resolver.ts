import {
    CreateIngredientRequestInput,
    UpdateIngredientRequestStatusInput,
} from "@app/operation/src/application/dtos"
import { IngredientRequestService } from "@app/operation/src/application/services"
import { IngredientRequest } from "@app/operation/src/domain/entities"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => IngredientRequest)
export class IngredientRequestMutationResolver {
    constructor(
        private readonly ingredientRequestService: IngredientRequestService,
    ) {}

    @Mutation(() => IngredientRequest, {
        description:
            "Create ingredient purchase request (Kitchen Staff/Fundraiser)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createIngredientRequest(
        @Args(
            "input",
            { type: () => CreateIngredientRequestInput },
            new ValidationPipe(),
        )
            input: CreateIngredientRequestInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<IngredientRequest> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.ingredientRequestService.createRequest(input, userContext)
    }

    @Mutation(() => IngredientRequest, {
        description: "Update ingredient request status (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateIngredientRequestStatus(
        @Args("id", { type: () => String, description: "Request ID" })
            id: string,
        @Args(
            "input",
            { type: () => UpdateIngredientRequestStatusInput },
            new ValidationPipe(),
        )
            input: UpdateIngredientRequestStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<IngredientRequest> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.ingredientRequestService.updateRequestStatus(
            id,
            input,
            userContext,
        )
    }
}
