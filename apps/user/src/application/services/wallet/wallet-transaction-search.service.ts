import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { OpenSearchService } from "@libs/aws-opensearch"
import { WalletRepository } from "../../repositories/wallet.repository"
import { SearchWalletTransactionInput } from "../../dtos/search-wallet-transaction.input"

@Injectable()
export class WalletTransactionSearchService implements OnModuleInit {
    private readonly logger = new Logger(WalletTransactionSearchService.name)
    private readonly indexName = "wallet-transactions"

    constructor(
        private readonly openSearchService: OpenSearchService,
        private readonly walletRepository: WalletRepository,
    ) { }

    async onModuleInit() {
        await this.createIndexIfNotExists()
    }

    private async createIndexIfNotExists() {
        const exists = await this.openSearchService.indexExists(this.indexName)
        if (exists) {
            // Update mapping if needed
            try {
                await (this.openSearchService as any).client.indices.putMapping({
                    index: this.indexName,
                    body: {
                        properties: {
                            description: { type: "text", analyzer: "standard" },
                            gateway: { type: "keyword" },
                            transactionType: { type: "keyword" },
                            amount: { type: "keyword" }, // Stored as string to preserve BigInt precision
                            balanceBefore: { type: "keyword" },
                            balanceAfter: { type: "keyword" },
                        }
                    }
                })
                this.logger.log(`Updated mapping for index ${this.indexName}`)
            } catch (error) {
                this.logger.error(`Failed to update mapping for index ${this.indexName}`, error)
            }
            return
        }

        await this.openSearchService.createIndex(this.indexName, {
            properties: {
                id: { type: "keyword" },
                walletId: { type: "keyword" },
                campaignId: { type: "keyword" },
                paymentTransactionId: { type: "keyword" },
                amount: { type: "keyword" },
                balanceBefore: { type: "keyword" },
                balanceAfter: { type: "keyword" },
                transactionType: { type: "keyword" },
                description: { type: "text", analyzer: "standard" },
                gateway: { type: "keyword" },
                sepayMetadata: { type: "text" }, // Store as text
                created_at: { type: "date" },
                updated_at: { type: "date" },
            },
        })
        this.logger.log(`Created index ${this.indexName}`)
    }

    async indexTransaction(transaction: any) {
        try {
            await this.openSearchService.indexDocument({
                index: this.indexName,
                id: transaction.id,
                body: {
                    id: transaction.id,
                    walletId: transaction.wallet_id || transaction.walletId,
                    campaignId: transaction.campaign_id || transaction.campaignId || null,
                    paymentTransactionId: transaction.payment_transaction_id || transaction.paymentTransactionId || null,
                    amount: transaction.amount.toString(),
                    balanceBefore: transaction.balance_before?.toString() || transaction.balanceBefore?.toString() || "0",
                    balanceAfter: transaction.balance_after?.toString() || transaction.balanceAfter?.toString() || "0",
                    transactionType: transaction.transaction_type || transaction.transactionType,
                    description: transaction.description || "",
                    gateway: transaction.gateway || null,
                    sepayMetadata: transaction.sepay_metadata ? JSON.stringify(transaction.sepay_metadata) : (transaction.sepayMetadata ? JSON.stringify(transaction.sepayMetadata) : null),
                    created_at: transaction.created_at,
                    updated_at: transaction.updated_at || transaction.created_at,
                }
            })
            this.logger.log(`Indexed wallet transaction ${transaction.id}`)
        } catch (error) {
            this.logger.error(`Failed to index wallet transaction ${transaction.id}`, error)
        }
    }

    async search(input: SearchWalletTransactionInput) {
        const {
            walletId,
            query,
            transactionType,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            sortBy,
            page = 1,
            limit = 10,
        } = input

        const must: any[] = []

        // Enforce walletId
        must.push({ term: { walletId } })

        if (query) {
            must.push({
                multi_match: {
                    query,
                    fields: ["description", "gateway", "paymentTransactionId", "campaignId"],
                    fuzziness: "AUTO",
                },
            })
        }

        if (transactionType) {
            must.push({ term: { transactionType } })
        }

        if (minAmount || maxAmount) {
            const range: any = {}
            if (minAmount) range.gte = minAmount
            if (maxAmount) range.lte = maxAmount
            // Note: Range on keyword might be inaccurate for numbers, but consistent with other services
            must.push({ range: { amount: range } })
        }

        if (startDate || endDate) {
            const range: any = {}
            if (startDate) range.gte = startDate
            if (endDate) range.lte = endDate
            must.push({ range: { created_at: range } })
        }

        const sort: any[] = []
        if (sortBy === "NEWEST") {
            sort.push({ created_at: "desc" })
        } else if (sortBy === "OLDEST") {
            sort.push({ created_at: "asc" })
        } else if (sortBy === "HIGHEST_AMOUNT") {
            sort.push({ amount: "desc" })
        } else if (sortBy === "LOWEST_AMOUNT") {
            sort.push({ amount: "asc" })
        } else {
            sort.push({ created_at: "desc" })
        }

        const from = (page - 1) * limit

        const result = await this.openSearchService.search({
            index: this.indexName,
            from,
            size: limit,
            query: {
                bool: {
                    must,
                },
            },
            sort,
        })

        return {
            items: result.hits.map((hit: any) => ({
                id: hit.id,
                wallet_id: hit.walletId,
                campaign_id: hit.campaignId,
                payment_transaction_id: hit.paymentTransactionId,
                amount: hit.amount,
                balance_before: hit.balanceBefore,
                balance_after: hit.balanceAfter,
                transaction_type: hit.transactionType,
                description: hit.description,
                gateway: hit.gateway,
                sepay_metadata: hit.sepayMetadata ? JSON.parse(hit.sepayMetadata) : null,
                created_at: hit.created_at,
                updated_at: hit.updated_at,
            })),
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async syncAll() {
        this.logger.log("Starting scheduled wallet transaction sync...")
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const transactions = await this.walletRepository.findRecentlyUpdatedTransactions(fiveMinutesAgo)

        if (transactions.length === 0) {
            return { successCount: 0, failCount: 0 }
        }

        this.logger.log(`Found ${transactions.length} wallet transactions to sync`)

        let successCount = 0
        let failCount = 0

        for (const transaction of transactions) {
            try {
                await this.indexTransaction(transaction)
                successCount++
            } catch (error) {
                this.logger.error(`Failed to sync wallet transaction ${transaction.id}`, error)
                failCount++
            }
        }

        this.logger.log(
            `Sync completed. Success: ${successCount}, Failed: ${failCount}`,
        )
        return { successCount, failCount }
    }
}
