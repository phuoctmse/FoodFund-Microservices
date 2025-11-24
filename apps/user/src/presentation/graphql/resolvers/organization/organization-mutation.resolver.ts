import { Resolver, Mutation } from "@nestjs/graphql"
import { Logger } from "@nestjs/common"

import { CurrentUser, CurrentUserType, RequireRole } from "libs/auth"
import { OrganizationService } from "@app/user/src/application/services"
import { LeaveOrganizationResponse } from "@app/user/src/shared/types"
import { Role } from "@libs/databases"

@Resolver()
export class OrganizationMutationResolver {
    private readonly logger = new Logger(OrganizationMutationResolver.name)

    constructor(
        private readonly organizationService: OrganizationService,
    ) {}

    @Mutation(() => LeaveOrganizationResponse, {
        description:
            "Leave organization voluntarily (Staff only: KITCHEN_STAFF, DELIVERY_STAFF)",
    })
    @RequireRole(Role.KITCHEN_STAFF, Role.DELIVERY_STAFF)
    async leaveOrganization(
        @CurrentUser() user: CurrentUserType,
    ): Promise<LeaveOrganizationResponse> {
        this.logger.log(
            `User ${user.cognitoId} requesting to leave organization`,
        )

        const result = await this.organizationService.leaveOrganization(
            user.cognitoId,
        )

        this.logger.log(
            `User ${user.cognitoId} successfully left organization`,
        )

        return result
    }
}
