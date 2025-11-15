import { ValidationPipe } from "@nestjs/common"
import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql"
import { Role } from "@app/operation/src/shared"
import { InflowTransactionService } from "../../../application/services"
import { InflowTransaction } from "../../../domain/entities/inflow-transaction.model"
import {
    ConfirmDisbursementInput,
    InflowTransactionListResponse,
} from "../../../application/dtos"
import { MyInflowTransactionFilterInput } from "@app/operation/src/application/dtos/inflow-transaction/inflow-transaction-filter.input"
import { CurrentUserType, RequireRole, CurrentUser } from "@libs/auth"

@Resolver(() => InflowTransaction)
export class InflowTransactionFundraiserResolver {
    constructor(
        private readonly inflowTransactionService: InflowTransactionService,
    ) {}

    @Mutation(() => InflowTransaction, {
        name: "confirmDisbursement",
        description:
            "Fundraiser reports disbursement status. " +
            "Status can be COMPLETED (money received) or FAILED (money not received). " +
            "In both cases, is_reported will be set to true and reported_at timestamp recorded. " +
            "If COMPLETED, the linked request will be marked as DISBURSED.",
    })
    @RequireRole(Role.FUNDRAISER)
    async confirmDisbursement(
        @Args(
            "input",
            { type: () => ConfirmDisbursementInput },
            new ValidationPipe(),
        )
            input: ConfirmDisbursementInput,
        @CurrentUser() user: CurrentUserType,    
    ): Promise<InflowTransaction> {
        return this.inflowTransactionService.confirmDisbursement(
            input,
            user,
        )
    }

    @Query(() => InflowTransactionListResponse, {
        name: "getMyDisbursements",
        description:
            "Get disbursements for the current fundraiser with optional filters. " +
            "Fundraiser only sees their own disbursements.",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyDisbursements(
        @Args("filter", {
            type: () => MyInflowTransactionFilterInput,
            nullable: true,
        })
            filter: MyInflowTransactionFilterInput = {},
        @Args("page", { type: () => Int, defaultValue: 1 }) page: number,
        @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
        @CurrentUser() user: CurrentUserType,
    ): Promise<InflowTransactionListResponse> {
        return this.inflowTransactionService.getMyDisbursements(
            filter,
            page,
            limit,
            user,
        )
    }

    @Query(() => InflowTransaction, {
        name: "getMyDisbursementById",
        description: "Get a single disbursement by ID (Fundraiser - own only).",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyDisbursementById(
        @Args("id", { type: () => String }) id: string,
        @CurrentUser() user: CurrentUserType,
    ): Promise<InflowTransaction> {
        return this.inflowTransactionService.getDisbursementById(
            id,
            user,
        )
    }
}
