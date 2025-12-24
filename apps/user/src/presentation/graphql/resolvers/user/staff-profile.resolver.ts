import {
    OrganizationService,
} from "@app/user/src/application/services"
import {
    OrganizationWithMembers,
} from "@app/user/src/shared/types"
import { RequireRole, CurrentUser, CurrentUserType } from "@libs/auth"
import { Role } from "@libs/databases"
import { Resolver, Query } from "@nestjs/graphql"

@Resolver()
export class StaffProfileResolver {
    constructor(
        private readonly organizationService: OrganizationService,
    ) { }

    @Query(() => OrganizationWithMembers, {
        description:
            "Get the organization that this staff member belongs to with all members (KITCHEN_STAFF, DELIVERY_STAFF only)",
        nullable: true,
    })
    @RequireRole(Role.KITCHEN_STAFF, Role.DELIVERY_STAFF)
    async getMyOrganization(@CurrentUser() user: CurrentUserType) {
        return this.organizationService.getStaffOrganization(
            user.cognitoId,
        )
    }
}
