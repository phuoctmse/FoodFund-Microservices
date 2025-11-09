import {
    CreateOperationRequestInput,
    UpdateOperationRequestStatusInput,
} from "@app/operation/src/application/dtos"
import { OperationRequestService } from "@app/operation/src/application/services"
import { OperationRequest } from "@app/operation/src/domain"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => OperationRequest)
export class OperationRequestMutationResolver {
    constructor(
        private readonly operationRequestService: OperationRequestService,
    ) {}

    @Mutation(() => OperationRequest, {
        name: "createOperationRequest",
        description:
            "Create operation request (COOKING: KITCHEN_STAFF/FUNDRAISER, DELIVERY: DELIVERY_STAFF/FUNDRAISER). " +
            "Only one PENDING/APPROVED request per expense type per campaign phase.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createOperationRequest(
        @Args(
            "input",
            { type: () => CreateOperationRequestInput },
            new ValidationPipe(),
        )
            input: CreateOperationRequestInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<OperationRequest> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.operationRequestService.createRequest(input, userContext)
    }

    @Mutation(() => OperationRequest, {
        name: "updateOperationRequestStatus",
        description:
            "Update operation request status (Admin only). " +
            "Transitions: PENDING → APPROVED/REJECTED, APPROVED → PENDING. " +
            "Admin note required when REJECTED.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateOperationRequestStatus(
        @Args(
            "input",
            { type: () => UpdateOperationRequestStatusInput },
            new ValidationPipe(),
        )
            input: UpdateOperationRequestStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<OperationRequest> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.operationRequestService.updateRequestStatus(
            input,
            userContext,
        )
    }
}
