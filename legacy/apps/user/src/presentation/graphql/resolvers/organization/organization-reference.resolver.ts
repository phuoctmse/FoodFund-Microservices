import { Resolver, ResolveReference } from "@nestjs/graphql"
import { OrganizationSchema } from "@app/user/src/domain/entities"
import { OrganizationService } from "@app/user/src/application/services"
import { Logger } from "@nestjs/common"

@Resolver(() => OrganizationSchema)
export class OrganizationReferenceResolver {
    private readonly logger = new Logger(OrganizationReferenceResolver.name)

    constructor(private readonly organizationService: OrganizationService) {}

    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        try {
            const org = await this.organizationService.getOrganizationById(
                reference.id,
            )
            return org
        } catch (error) {
            this.logger.error("❌ [OrganizationReferenceResolver] Error:", error)
            return null
        }
    }
}
