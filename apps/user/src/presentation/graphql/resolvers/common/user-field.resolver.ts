import { Resolver, ResolveField, Parent } from "@nestjs/graphql"
import { UserProfileSchema } from "../../../../domain/entities"
import { Badge } from "../../models/badge.model"
import { DataLoaderService } from "../../../../application/services"
import { Role } from "../../../../domain/enums"

@Resolver(() => UserProfileSchema)
export class UserFieldResolver {
    constructor(private readonly dataLoaderService: DataLoaderService) {}

        @ResolveField(() => Badge, { nullable: true })
    async badge(@Parent() user: UserProfileSchema): Promise<Badge | null> {
        // Only DONOR role can have badges
        if (user.role !== Role.DONOR) {
            return null
        }

        // Use DataLoader to efficiently fetch badge
        return this.dataLoaderService.getUserBadge(user.id)
    }
}
