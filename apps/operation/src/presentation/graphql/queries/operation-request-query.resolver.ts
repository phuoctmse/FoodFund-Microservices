import {
    OperationRequestFilterInput,
    OperationRequestStatsResponse,
} from "@app/operation/src/application/dtos"
import { OperationRequestService } from "@app/operation/src/application/services"
import { OperationRequest } from "@app/operation/src/domain"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => OperationRequest)
export class OperationRequestQueryResolver {
    constructor(
        private readonly operationRequestService: OperationRequestService,
    ) {}

    @Query(() => [OperationRequest], {
        name: "operationRequests",
        description:
            "Get operation requests with filters (campaignId, phaseId, status, expenseType). Public access for transparency.",
    })
    async getOperationRequests(
        @Args(
            "filter",
            { type: () => OperationRequestFilterInput },
            new ValidationPipe(),
        )
            filter: OperationRequestFilterInput,
    ): Promise<OperationRequest[]> {
        return this.operationRequestService.getRequests(filter)
    }

    @Query(() => OperationRequest, {
        name: "operationRequest",
        description:
            "Get single operation request by ID. Public access for transparency.",
    })
    async getOperationRequestById(
        @Args("id", { type: () => String })
            id: string,
    ): Promise<OperationRequest> {
        return this.operationRequestService.getRequestById(id)
    }

    @Query(() => [OperationRequest], {
        name: "myOperationRequests",
        description:
            "Get operation requests created by current user (authentication required)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyOperationRequests(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("limit", { type: () => Int, nullable: true, defaultValue: 10 })
            limit: number,
        @Args("offset", { type: () => Int, nullable: true, defaultValue: 0 })
            offset: number,
    ): Promise<OperationRequest[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.operationRequestService.getMyRequests(
            userContext,
            limit,
            offset,
        )
    }

    @Query(() => OperationRequestStatsResponse, {
        name: "operationRequestStats",
        description: "Get operation request statistics (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getOperationRequestStats(
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<OperationRequestStatsResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.operationRequestService.getStats(userContext)
    }
}
