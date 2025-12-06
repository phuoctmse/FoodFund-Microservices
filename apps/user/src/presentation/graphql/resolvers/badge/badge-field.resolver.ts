import { Resolver, ResolveField, Parent } from "@nestjs/graphql"
import { Badge } from "../../../../domain/entities/badge.model"
import { BadgeMilestone } from "../../../../domain/entities/badge-milestone.model"
import { BadgeMilestoneService } from "../../../../application/services/badge"

@Resolver(() => Badge)
export class BadgeFieldResolver {
    constructor(
        private readonly badgeMilestoneService: BadgeMilestoneService,
    ) { }

    @ResolveField(() => BadgeMilestone, { nullable: true })
    milestone(@Parent() badge: Badge): BadgeMilestone | null {
        return this.badgeMilestoneService.getMilestoneByBadgeId(badge.id)
    }
}
