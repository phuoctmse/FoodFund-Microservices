import { AssignTaskToStaffInput, SelfAssignTaskInput, UpdateDeliveryTaskStatusInput } from "@app/operation/src/application/dtos/delivery-task"
import { DeliveryTaskService } from "@app/operation/src/application/services"
import { DeliveryTask } from "@app/operation/src/domain"
import { CognitoGraphQLGuard, createUserContextFromToken, CurrentUser } from "@app/operation/src/shared"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => DeliveryTask)
export class DeliveryTaskMutationResolver {
    constructor(
        private readonly deliveryTaskService: DeliveryTaskService,
    ) {}

    @Mutation(() => [DeliveryTask], {
        name: "assignDeliveryTaskToStaff",
        description:
            "Fundraiser assigns 1 meal batch to MULTIPLE delivery staff (status = PENDING). " +
            "All staff share responsibility for the entire batch. " +
            "Returns array of created tasks (1 per staff). " +
            "Conflict check: Staff cannot have active tasks (ACCEPTED/OUT_FOR_DELIVERY) in same campaign phase.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async assignDeliveryTaskToStaff(
        @Args(
            "input",
            { type: () => AssignTaskToStaffInput },
            new ValidationPipe(),
        )
            input: AssignTaskToStaffInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<DeliveryTask[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.deliveryTaskService.assignTaskToStaff(input, userContext)
    }

    @Mutation(() => DeliveryTask, {
        name: "selfAssignDeliveryTask",
        description:
            "Delivery staff self-assigns task from READY meal batch (status = ACCEPTED). " +
            "Task is immediately accepted without pending approval.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async selfAssignDeliveryTask(
        @Args(
            "input",
            { type: () => SelfAssignTaskInput },
            new ValidationPipe(),
        )
            input: SelfAssignTaskInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<DeliveryTask> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.deliveryTaskService.selfAssignTask(input, userContext)
    }

    @Mutation(() => DeliveryTask, {
        name: "updateDeliveryTaskStatus",
        description:
            "Update delivery task status. " +
            "Transitions: " +
            "PENDING → ACCEPTED/REJECTED (Delivery staff only), " +
            "ACCEPTED → OUT_FOR_DELIVERY (Delivery staff only, updates meal batch to DELIVERED), " +
            "OUT_FOR_DELIVERY → COMPLETED/FAILED (Delivery staff OR Fundraiser). " +
            "Note required for FAILED/REJECTED.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateDeliveryTaskStatus(
        @Args(
            "input",
            { type: () => UpdateDeliveryTaskStatusInput },
            new ValidationPipe(),
        )
            input: UpdateDeliveryTaskStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<DeliveryTask> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.deliveryTaskService.updateTaskStatus(input, userContext)
    }
}