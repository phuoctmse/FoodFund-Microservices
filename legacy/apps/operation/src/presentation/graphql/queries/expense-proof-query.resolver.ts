import { ExpenseProofFilterInput } from "@app/operation/src/application/dtos/expense-proof"
import { ExpenseProofStatsResponse } from "@app/operation/src/application/dtos/expense-proof/response/expense-proof-stats.response"
import { ExpenseProofService } from "@app/operation/src/application/services"
import { ExpenseProof } from "@app/operation/src/domain"
import { ExpenseProofSortOrder } from "@app/operation/src/domain/enums/expense-proof"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => ExpenseProof)
export class ExpenseProofQueryResolver {
    constructor(
        private readonly expenseProofService: ExpenseProofService,
    ) {}

    @Query(() => ExpenseProof, {
        nullable: true,
        description: "Get expense proof by ID",
    })
    async getExpenseProof(
        @Args("id", { type: () => String }) id: string,
    ): Promise<ExpenseProof | null> {
        return await this.expenseProofService.getExpenseProof(id)
    }

    @Query(() => [ExpenseProof], {
        description: "Get expense proofs",
    })
    async getExpenseProofs(
        @Args("filter", {
            type: () => ExpenseProofFilterInput,
            nullable: true,
        })
            filter: ExpenseProofFilterInput,
        @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
        @Args("offset", { type: () => Int, defaultValue: 0 }) offset: number,
    ): Promise<ExpenseProof[]> {
        return await this.expenseProofService.getExpenseProofs(
            filter || {},
            limit,
            offset,
        )
    }

    @Query(() => [ExpenseProof], {
        description:
            "Get expense proofs from my organization (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyExpenseProofs(
        @Args("requestId", {
            type: () => String,
            nullable: true,
            description: "Filter by specific ingredient request ID",
        })
            requestId: string | undefined,
        @Args("sortBy", {
            type: () => ExpenseProofSortOrder,
            nullable: true,
            defaultValue: ExpenseProofSortOrder.NEWEST_FIRST,
            description: "Sort order for expense proofs",
        })
            sortBy: ExpenseProofSortOrder,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProof[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.getMyExpenseProofs(
            requestId,
            userContext,
            sortBy,
        )
    }

    @Query(() => ExpenseProofStatsResponse, {
        description: "Get expense proof statistics (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getExpenseProofStats(
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProofStatsResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.getExpenseProofStats(userContext)
    }
}