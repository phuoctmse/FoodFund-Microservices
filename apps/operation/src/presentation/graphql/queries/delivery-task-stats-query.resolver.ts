import { DeliveryTaskStatsResponse } from "@app/operation/src/application/dtos/delivery-task"
import { DeliveryTaskService } from "@app/operation/src/application/services"
import { ValidationPipe } from "@nestjs/common"
import { Args, Query, Resolver } from "@nestjs/graphql"

@Resolver()
export class DeliveryTaskStatsQueryResolver {
    constructor(
        private readonly deliveryTaskService: DeliveryTaskService,
    ) {}

    @Query(() => DeliveryTaskStatsResponse, {
        name: "deliveryTaskStats",
        description:
            "Get delivery task statistics for a campaign phase. " +
            "Shows total tasks, counts by status, completion rate, and failure rate. " +
            "Public access for transparency.",
    })
    async getDeliveryTaskStats(
        @Args("campaignPhaseId", { type: () => String }, new ValidationPipe())
            campaignPhaseId: string,
    ): Promise<DeliveryTaskStatsResponse> {
        return this.deliveryTaskService.getStatsByCampaignPhase(campaignPhaseId)
    }
}