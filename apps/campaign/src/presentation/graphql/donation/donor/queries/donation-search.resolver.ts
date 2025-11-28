import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseInterceptors } from "@nestjs/common"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { DonationSearchService } from "../../../../../application/services/donation/donation-search.service"
import { SearchDonationInput } from "../../../../../application/dtos/campaign/request/search-donation.input"
import { CampaignDonationSummary, CampaignDonationStatementResponse } from "../../../../../application/dtos/donation"
import { PaymentStatus } from "@app/campaign/src/shared"

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
        input.status = PaymentStatus.SUCCESS

        const result = await this.donationSearchService.search(input, "receivedAmount", "receivedAmount")

        const page = input.page || 1
        const limit = input.limit || 10

        const transactions = result.items.flatMap((item: any) => {
            return (item.paymentTransactions || [])
                .filter((tx: any) => tx.status === PaymentStatus.SUCCESS)
                .map((tx: any) => {
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
                        amount: item.amount,
                        receivedAmount: tx.amount,
                        gateway: tx.gateway || "UNKNOWN",
                        orderCode: tx.transactionCode || item.transactionCode,
                        description: item.message,
                        campaignId: item.campaignId,
                        campaignTitle: item.campaignTitle,
                        bankName: tx.bankName,
                        bankAccountNumber: maskedBankAccount,
                        currency: item.currency,
                    }
                })
        }).map((tx: any, index: number) => ({
            ...tx,
            no: (page - 1) * limit + index + 1,
        }))

        const totalReceived = transactions.reduce((sum: number, tx: any) => sum + (parseFloat(tx.receivedAmount) || 0), 0)
        const totalDonations = transactions.length

        return {
            campaignId: input.campaignId || "",
            campaignTitle: result.items[0]?.campaignTitle || "",
            totalReceived: totalReceived.toString(),
            totalDonations: totalDonations,
            generatedAt: new Date().toISOString(),
            transactions: transactions,
        }
    }
}
