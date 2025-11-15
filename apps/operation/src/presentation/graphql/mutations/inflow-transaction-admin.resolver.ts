import { ValidationPipe } from "@nestjs/common"
import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql"
import { Role } from "@app/operation/src/shared"
import { InflowTransactionService } from "../../../application/services"
import { InflowTransaction } from "../../../domain/entities/inflow-transaction.model"
import {
    CreateInflowTransactionInput,
    InflowTransactionListResponse,
} from "../../../application/dtos"
import { InflowTransactionFilterInput } from "@app/operation/src/application/dtos/inflow-transaction/inflow-transaction-filter.input"
import { CurrentUserType, RequireRole, CurrentUser } from "@libs/auth"

@Resolver(() => InflowTransaction)
export class InflowTransactionAdminResolver {
    constructor(
        private readonly inflowTransactionService: InflowTransactionService,
    ) {}

    @Mutation(() => InflowTransaction, {
        name: "createInflowTransaction",
        description:
            "Create a new inflow transaction (disbursement). Admin only. " +
            "Must provide EITHER ingredientRequestId OR operationRequestId (not both). " +
            "Amount must match the request's total_cost. " +
            "Transaction type is automatically detected from the request. " +
            "Also provide campaignPhaseId, amount, and proof (S3 URL of bank transfer screenshot).",
    })
    @RequireRole(Role.ADMIN)
    async createInflowTransaction(
        @Args(
            "input",
            { type: () => CreateInflowTransactionInput },
            new ValidationPipe(),
        )
            input: CreateInflowTransactionInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<InflowTransaction> {
        return this.inflowTransactionService.createInflowTransaction(
            input,
            user,
        )
    }

    @Query(() => InflowTransactionListResponse, {
        name: "getListInflowTransaction",
        description:
            "Get all disbursements with optional filters. Admin only. " +
            "Supports filtering by campaign phase, receiver, type, status, and date range.",
    })
    @RequireRole(Role.ADMIN)
    async getListInflowTransaction(
        @Args("filter", {
            type: () => InflowTransactionFilterInput,
            nullable: true,
        })
            filter: InflowTransactionFilterInput = {},
        @Args("page", { type: () => Int, defaultValue: 1 }) page: number,
        @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
        @CurrentUser() user: CurrentUserType,
    ): Promise<InflowTransactionListResponse> {
        return this.inflowTransactionService.getDisbursements(
            filter,
            page,
            limit,
            user,
        )
    }

    @Query(() => InflowTransaction, {
        name: "getInflowTransactionDetails",
        description:
            "Get a single disbursement by ID. Admin or owner Fundraiser.",
    })
    @RequireRole(Role.ADMIN)
    async getInflowTransactionDetails(
        @Args("id", { type: () => String }) id: string,
        @CurrentUser() user: CurrentUserType,
    ): Promise<InflowTransaction> {
        return this.inflowTransactionService.getDisbursementById(
            id,
            user,
        )
    }
}
