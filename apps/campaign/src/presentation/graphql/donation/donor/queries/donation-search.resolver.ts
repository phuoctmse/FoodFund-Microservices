import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseInterceptors } from "@nestjs/common"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { DonationSearchService } from "../../../../../application/services/donation/donation-search.service"
import { SearchDonationInput } from "../../../../../application/dtos/campaign/request/search-donation.input"
import { CampaignDonationSummary, CampaignDonationStatementResponse } from "../../../../../application/dtos/donation"

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
            id: item.donationId,
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
        input.status = "SUCCESS"

        const result = await this.donationSearchService.search(input, "receivedAmount")

        const totalReceived = (result as any).totalAmount || 0

        const page = input.page || 1
        const limit = input.limit || 10

        return {
            campaignId: input.campaignId || "",
            campaignTitle: result.items[0]?.campaignTitle || "",
            totalReceived: totalReceived.toString(),
            totalDonations: result.total,
            generatedAt: new Date().toISOString(),
            transactions: result.items.flatMap((item: any) => {
                return (item.paymentTransactions || []).map((tx: any) => {
                    let maskedBankAccount = ""
                    const bankAccount = tx.bankAccount || ""
                    if (bankAccount && bankAccount.length > 4) {
                        maskedBankAccount = "****" + bankAccount.slice(-4)
                    } else {
                        maskedBankAccount = bankAccount
                    }

                    return {
                        donationId: item.id,
                        transactionDateTime: tx.createdAt || item.createdAt,
                        donorName: item.donorName,
                        amount: item.amount, // Donation amount
                        receivedAmount: tx.amount, // Transaction amount
                        gateway: tx.gateway || "UNKNOWN",
                        orderCode: tx.transactionCode || item.transactionCode,
                        description: item.message,
                        campaignId: item.campaignId,
                        campaignTitle: item.campaignTitle,
                        bankName: tx.bankName,
                        bankAccountNumber: maskedBankAccount,
                        currency: item.currency,
                        // status: tx.status, // Commented out to avoid potential DTO mismatch if field doesn't exist
                    }
                })
            }).map((tx: any, index: number) => ({
                ...tx,
                no: (page - 1) * limit + index + 1,
            })),
        }
    }
}
