import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { OpenSearchService } from "@libs/aws-opensearch"
import { DonorRepository } from "../../repositories/donor.repository"
import { SearchDonationInput } from "../../dtos/campaign/request/search-donation.input"

@Injectable()
export class DonationSearchService implements OnModuleInit {
    private readonly logger = new Logger(DonationSearchService.name)
    private readonly indexName = "donations"

    constructor(
        private readonly openSearchService: OpenSearchService,
        private readonly donorRepository: DonorRepository,
    ) { }

    async onModuleInit() {
        await this.createIndexIfNotExists()
        // this.logger.log("Forcing full donation sync on module init...")
        // await this.syncAll(new Date(0))
    }

    private async createIndexIfNotExists() {
        const exists = await this.openSearchService.indexExists(this.indexName)
        if (exists) return

        const mappings = {
            properties: {
                id: { type: "keyword" },
                campaignId: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                campaignTitle: { type: "text", analyzer: "standard" },
                donorName: { type: "text", analyzer: "standard" },
                donorEmail: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                amount: { type: "double" },
                currency: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                transactionCode: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                status: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                paymentMethod: {
                    type: "text",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
                isAnonymous: { type: "boolean" },
                message: { type: "text" },
                createdAt: { type: "date" },
                paymentTransactions: {
                    type: "nested",
                    properties: {
                        id: { type: "keyword" },
                        amount: { type: "double" },
                        method: { type: "keyword" },
                        status: { type: "keyword" },
                        transactionCode: { type: "keyword" },
                        gateway: { type: "keyword" },
                        bankName: { type: "keyword" },
                        bankAccount: { type: "keyword" },
                        createdAt: { type: "date" },
                    },
                },
            },
        }

        await this.openSearchService.createIndex(this.indexName, mappings)
        this.logger.log(`Index ${this.indexName} created`)
    }

    async indexDonation(donation: any) {
        try {
            const transactions = donation.payment_transactions || []
            const successfulTx = transactions.find((tx: any) => tx.status === "SUCCESS")
            const mainTx = successfulTx || transactions[0] || {}

            // received_amount is the actual money transferred
            const txReceivedAmount = successfulTx ? (successfulTx.received_amount || successfulTx.receivedAmount) : 0
            const receivedAmount = txReceivedAmount ? parseFloat(txReceivedAmount.toString()) : 0

            const status = successfulTx ? "SUCCESS" : (mainTx.status || "PENDING")

            const body = {
                id: donation.id,
                campaignId: donation.campaign_id,
                campaignTitle: donation.campaign?.title || "",
                donorName: donation.is_anonymous ? "Anonymous" : (donation.donor_name || "Guest"),
                donorEmail: donation.donor_email,
                amount: parseFloat(donation.amount.toString()), // Order amount
                receivedAmount: receivedAmount, // Actual received amount
                currency: mainTx.currency || "VND",
                transactionCode: mainTx.order_code ? mainTx.order_code.toString() : (mainTx.external_transaction_id || ""),
                status: status,
                paymentMethod: mainTx.payment_method || "UNKNOWN",
                gateway: mainTx.gateway || "UNKNOWN",
                isAnonymous: donation.is_anonymous,
                message: donation.message,
                createdAt: donation.created_at,
                paymentTransactions: transactions.map((tx) => {
                    const sepayMetadata = tx.sepay_metadata ? (typeof tx.sepay_metadata === "string" ? JSON.parse(tx.sepay_metadata) : tx.sepay_metadata) : {}
                    const txRecv = (tx.received_amount || tx.receivedAmount)
                    return {
                        id: tx.id,
                        // For statements, we care about the received amount. 
                        // Since we can't change index schema easily, we store received_amount in 'amount' field for the transaction.
                        amount: txRecv ? parseFloat(txRecv.toString()) : 0,
                        method: tx.payment_method,
                        status: tx.status,
                        transactionCode: tx.order_code ? tx.order_code.toString() : (tx.external_transaction_id || ""),
                        gateway: tx.gateway,
                        bankName: sepayMetadata.bank_name || null,
                        bankAccount: sepayMetadata.bank_account || null,
                        createdAt: tx.created_at,
                    }
                }),
            }

            await this.openSearchService.indexDocument({
                index: this.indexName,
                id: donation.id,
                body,
            })
            this.logger.log(`Indexed donation ${donation.id}`)
        } catch (error) {
            this.logger.error(`Failed to index donation ${donation.id}`, error)
        }
    }

    async search(input: SearchDonationInput, sortByField: string = "createdAt", aggField: string = "amount") {
        const {
            campaignId,
            donorEmail,
            status,
            startDate,
            endDate,
            minAmount,
            maxAmount,
            page = 1,
            limit = 10,
        } = input

        const must: any[] = []
        const filter: any[] = []

        if (campaignId) must.push({ term: { "campaignId.keyword": campaignId } })
        if (donorEmail) must.push({ term: { "donorEmail.keyword": donorEmail } })
        if (status) must.push({ term: { "status.keyword": status } })

        if (startDate || endDate) {
            const range: any = {}
            if (startDate) range.gte = startDate
            if (endDate) range.lte = endDate
            filter.push({ range: { createdAt: range } })
        }

        if (minAmount != null || maxAmount != null) {
            const range: any = {}
            if (minAmount != null) range.gte = minAmount
            if (maxAmount != null) range.lte = maxAmount
            filter.push({ range: { amount: range } })
        }

        const from = (page - 1) * limit

        const aggs = {
            totalAmount: {
                sum: { field: aggField }
            }
        }

        const searchBody = {
            index: this.indexName,
            query: {
                bool: { must, filter },
            },
            from,
            size: limit,
            sort: [{ [sortByField]: "desc" }],
            aggs,
        }

        const result = await this.openSearchService.search(searchBody)

        return {
            items: result.hits.map((hit: any) => hit),
            total: result.total,
            totalAmount: result.aggregations?.totalAmount?.value || 0,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async syncAll(since?: Date) {
        this.logger.log("Starting scheduled donation sync...")
        const syncSince = since || new Date(Date.now() - 5 * 60 * 1000)
        const donations = await this.donorRepository.findRecentlyUpdated(syncSince)

        if (donations.length === 0) {
            return { successCount: 0, failCount: 0 }
        }

        this.logger.log(`Found ${donations.length} donations to sync`)

        let successCount = 0
        let failCount = 0

        for (const donation of donations) {
            try {
                await this.indexDonation(donation)
                successCount++
            } catch (error) {
                this.logger.error(`Failed to sync donation ${donation.id}`, error)
                failCount++
            }
        }

        this.logger.log(
            `Sync completed. Success: ${successCount}, Failed: ${failCount}`,
        )
        return { successCount, failCount }
    }
}
