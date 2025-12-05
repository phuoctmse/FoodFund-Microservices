import { Resolver, Query, Args } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser, CurrentUserType } from "@libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { BadgeService, UserBadgeService } from "../../../../application/services/badge"
import { Badge, UserBadge } from "../../../../domain/entities/badge.model"

@Resolver(() => Badge)
export class BadgeQueryResolver {
    constructor(
        private readonly badgeService: BadgeService,
        private readonly userBadgeService: UserBadgeService,
    ) { }

    @Query(() => [Badge], { description: "Get all active badges" })
    async getAllBadges() {
        return this.badgeService.getAllBadges(false)
    }

    @Query(() => Badge, { nullable: true, description: "Get badge by ID" })
    async getBadgeId(@Args("id") id: string) {
        return this.badgeService.getBadgeById(id)
    }

    @Query(() => UserBadge, {
        nullable: true,
        description: "Get current user's badge",
    })
    @UseGuards(CognitoGraphQLGuard)
    async myBadge(@CurrentUser() user: CurrentUserType) {
        return this.userBadgeService.getUserBadge(user.cognitoId)
    }
}
