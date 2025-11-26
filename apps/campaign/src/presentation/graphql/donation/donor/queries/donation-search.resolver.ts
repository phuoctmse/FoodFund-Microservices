import { Args, Query, Resolver, Mutation } from "@nestjs/graphql"
import { UseInterceptors } from "@nestjs/common"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { DonationSearchService } from "../../../../../application/services/donation/donation-search.service"
import { SearchDonationInput } from "../../../../../application/dtos/campaign/request/search-donation.input"
import { CampaignDonationSummary, CampaignDonationStatementResponse } from "../../../../../application/dtos/donation"
import { SyncResult } from "../../../../../application/dtos/donation/sync-result.dto"

@Resolver()
@UseInterceptors(SentryInterceptor)
export class DonationSearchResolver {
    constructor(private readonly donationSearchService: DonationSearchService) { }

    @Query(() => [CampaignDonationSummary], {
        description: "Search donations using OpenSearch",
    })
    async searchDonations(
        @Args("input") input: SearchDonationInput,
    ): Promise<CampaignDonationSummary[]> {
        const result = await this.donationSearchService.search(input)

        return result.items.map((item: any) => ({
            id: item.id,
            donorId: item.donorId,
            donorName: item.donorName,
            campaignId: item.campaignId,
            amount: item.amount,
            isAnonymous: item.isAnonymous,
            createdAt: item.createdAt,
            transactionDatetime: item.transactionDatetime,
            orderCode: item.orderCode,
            status: item.status,
        }))
    }

    @Query(() => CampaignDonationStatementResponse, {
        description: "Search donation statements (detailed view, SUCCESS only)",
    })
    async searchDonationStatements(
        @Args("input") input: SearchDonationInput,
    ): Promise<CampaignDonationStatementResponse> {
        // Enforce SUCCESS status for statements
        input.status = "SUCCESS"

        const result = await this.donationSearchService.search(input, "receivedAmount")

        const totalReceived = result.items.reduce(
            (sum: number, item: any) => sum + parseFloat(item.amount),
            0,
        )

        const page = input.page || 1
        const limit = input.limit || 10

        return {
            campaignId: input.campaignId || "",
            campaignTitle: result.items[0]?.campaignTitle || "",
            totalReceived: totalReceived.toString(),
            totalDonations: result.total,
            generatedAt: new Date().toISOString(),
            transactions: result.items.map((item: any, index: number) => {
                // Mask bank account: ****1234
                let maskedBankAccount = ""
                if (item.bankAccount && item.bankAccount.length > 4) {
                    maskedBankAccount = "****" + item.bankAccount.slice(-4)
                } else {
                    maskedBankAccount = item.bankAccount || ""
                }

                return {
                    no: (page - 1) * limit + index + 1,
                    donationId: item.id,
                    transactionDateTime: item.transactionDatetime,
                    donorName: item.donorName,
                    amount: item.amount,
                    receivedAmount: item.receivedAmount || item.amount,
                    gateway: item.gateway || "UNKNOWN",
                    orderCode: item.orderCode,
                    description: item.description,
                    campaignId: item.campaignId,
                    campaignTitle: item.campaignTitle,
                    bankName: item.bankName,
                    bankAccountNumber: maskedBankAccount,
                    currency: item.currency,
                }
            }),
        }
    }

    @Mutation(() => SyncResult, {
        description: "Sync all donations to OpenSearch (Admin only)",
    })
    async syncDonations(): Promise<SyncResult> {
        return this.donationSearchService.syncAll()
    }
}
