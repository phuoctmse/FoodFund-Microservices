import {
    CreateExpenseProofInput,
    GenerateExpenseProofUploadUrlsInput,
    UpdateExpenseProofStatusInput,
} from "@app/operation/src/application/dtos"
import { ExpenseProofUploadResponse } from "@app/operation/src/application/dtos/expense-proof"
import { ExpenseProofService } from "@app/operation/src/application/services"
import { ExpenseProof } from "@app/operation/src/domain"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/operation/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => ExpenseProof)
export class ExpenseProofMutationResolver {
    constructor(private readonly expenseProofService: ExpenseProofService) {}

    @Mutation(() => ExpenseProofUploadResponse, {
        description:
            "Generate pre-signed URLs for uploading expense proof media (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async generateExpenseProofUploadUrls(
        @Args("input") input: GenerateExpenseProofUploadUrlsInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProofUploadResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.generateUploadUrls(
            input,
            userContext,
        )
    }

    @Mutation(() => ExpenseProof, {
        description:
            "Create expense proof with uploaded media (Kitchen Staff only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createExpenseProof(
        @Args("input") input: CreateExpenseProofInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProof> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.createExpenseProof(
            input,
            userContext,
        )
    }

    @Mutation(() => ExpenseProof, {
        description: "Approve or reject expense proof (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateExpenseProofStatus(
        @Args("id") id: string,
        @Args("input") input: UpdateExpenseProofStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<ExpenseProof> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.expenseProofService.updateExpenseProofStatus(
            id,
            input,
            userContext,
        )
    }
}
