import {
    AssignCampaignToOrganizationsInput,
    RespondReassignmentInput,
} from "@app/campaign/src/application/dtos/campaign-reassignment/request"
import { AssignCampaignResponse } from "@app/campaign/src/application/dtos/campaign-reassignment/response"
import { CampaignReassignmentService } from "@app/campaign/src/application/services/campaign-reassignment"
import { CampaignReassignment } from "@app/campaign/src/domain/entities/campaign-reassignment.model"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { SentryInterceptor } from "@libs/observability"
import { UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => CampaignReassignment)
@UseInterceptors(SentryInterceptor)
export class ReassignmentMutationResolver {
    constructor(
        private readonly reassignmentService: CampaignReassignmentService,
    ) {}

    @Mutation(() => AssignCampaignResponse, {
        description:
            "Assign cancelled campaign to selected organizations (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async assignCampaignToOrganizations(
        @Args(
            "input",
            { type: () => AssignCampaignToOrganizationsInput },
            new ValidationPipe(),
        )
            input: AssignCampaignToOrganizationsInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<AssignCampaignResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.reassignmentService.assignCampaignToOrganizations(
            input,
            userContext,
        )
    }

    @Mutation(() => CampaignReassignment, {
        description: "Respond to reassignment request (Fundraiser only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async respondToReassignment(
        @Args(
            "input",
            { type: () => RespondReassignmentInput },
            new ValidationPipe(),
        )
            input: RespondReassignmentInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignReassignment> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.reassignmentService.respondToReassignment(
            input,
            userContext,
        )
    }
}
