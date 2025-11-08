import { ExpenseProofFilterInput } from "@app/operation/src/application/dtos/expense-proof"
import { ExpenseProofStatsResponse } from "@app/operation/src/application/dtos/expense-proof/response/expense-proof-stats.response"
import { ExpenseProofService } from "@app/operation/src/application/services"
import { ExpenseProof } from "@app/operation/src/domain"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => ExpenseProof)
export class ExpenseProofQueryResolver {
    constructor(private readonly expenseProofService: ExpenseProofService) {}

    @Query(() => ExpenseProof, {
        nullable: true,
        description: "Get expense proof by ID",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getExpenseProof(
        @Args("id", { type: () => String }) id: string,
    ): Promise<ExpenseProof | null> {
        return await this.expenseProofService.getExpenseProof(id)
    }

    @Query(() => [ExpenseProof], {
        description: "Get expense proofs with filters (Fundraiser/Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getExpenseProofs(
        @Args("filter", {
            type: () => ExpenseProofFilterInput,
            nullable: true,
        })
            filter: ExpenseProofFilterInput,
        @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
        @Args("offset", { type: () => Int, defaultValue: 0 }) offset: number,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProof[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.getExpenseProofs(
            filter || {},
            limit,
            offset,
            userContext,
        )
    }

    @Query(() => [ExpenseProof], {
        description:
            "Get expense proofs from my organization (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyExpenseProofs(
        @Args("requestId", { type: () => String, nullable: true })
            requestId: string | undefined,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProof[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.getMyExpenseProofs(
            requestId,
            userContext,
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
