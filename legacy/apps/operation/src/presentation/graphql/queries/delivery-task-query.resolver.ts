import { DeliveryTaskFilterInput } from "@app/operation/src/application/dtos/delivery-task"
import { DeliveryTaskService } from "@app/operation/src/application/services"
import { DeliveryTask } from "@app/operation/src/domain"
import { CognitoGraphQLGuard, createUserContextFromToken, CurrentUser } from "@app/operation/src/shared"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => DeliveryTask)
export class DeliveryTaskQueryResolver {
    constructor(
        private readonly deliveryTaskService: DeliveryTaskService,
    ) {}

    @Query(() => [DeliveryTask], {
        name: "deliveryTasks",
        description:
            "Get delivery tasks with filters (campaignPhaseId, mealBatchId, deliveryStaffId, status). Public access for transparency.",
    })
    async getDeliveryTasks(
        @Args(
            "filter",
            { type: () => DeliveryTaskFilterInput },
            new ValidationPipe(),
        )
            filter: DeliveryTaskFilterInput,
    ): Promise<DeliveryTask[]> {
        return this.deliveryTaskService.getTasks(filter)
    }

    @Query(() => DeliveryTask, {
        name: "deliveryTask",
        description:
            "Get single delivery task by ID. Public access for transparency.",
    })
    async getDeliveryTaskById(
        @Args("id", { type: () => String })
            id: string,
    ): Promise<DeliveryTask> {
        return this.deliveryTaskService.getTaskById(id)
    }

    @Query(() => [DeliveryTask], {
        name: "myDeliveryTasks",
        description:
            "Get delivery tasks assigned to current delivery staff (authentication required)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDeliveryTasks(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("limit", { type: () => Int, nullable: true, defaultValue: 10 })
            limit: number,
        @Args("offset", { type: () => Int, nullable: true, defaultValue: 0 })
            offset: number,
    ): Promise<DeliveryTask[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.deliveryTaskService.getMyTasks(userContext, limit, offset)
    }
}