import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { OpenSearchService } from "@libs/aws-opensearch"
import { Donation } from "../../../domain/entities/donation.model"
import { DonationSortBy, SearchDonationInput } from "../../dtos/campaign/request/search-donation.input"
import { DonorRepository } from "../../repositories/donor.repository"

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
    }

    private async createIndexIfNotExists() {
        const exists = await this.openSearchService.indexExists(this.indexName)
        if (exists) {
            try {
                await (this.openSearchService as any).client.indices.putMapping({
                    index: this.indexName,
                    body: {
                        properties: {
                            campaignTitle: { type: "text", analyzer: "standard" },
                            description: { type: "text", analyzer: "standard" },
                            gateway: { type: "keyword" },
                            paymentStatus: { type: "keyword" },
                            receivedAmount: { type: "keyword" },
                            bankName: { type: "text", analyzer: "standard" },
                            bankAccount: { type: "keyword" },
                            currency: { type: "keyword" },
                            errorCode: { type: "keyword" },
                            errorDescription: { type: "text", analyzer: "standard" },
                            refundedAt: { type: "date" },
                            processedByWebhook: { type: "boolean" },
                            payosMetadata: { type: "text" }, // Store as text for full searchability
                            sepayMetadata: { type: "text" },
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
            mappings: {
                properties: {
                    id: { type: "keyword" },
                    donorId: { type: "keyword" },
                    donorName: { type: "text", analyzer: "standard" },
                    campaignId: { type: "keyword" },
                    campaignTitle: { type: "text", analyzer: "standard" },
                    amount: { type: "keyword" },
                    isAnonymous: { type: "boolean" },
                    status: { type: "keyword" },
                    orderCode: { type: "keyword" },
                    transactionDatetime: { type: "date" },
                    description: { type: "text", analyzer: "standard" },
                    gateway: { type: "keyword" },
                    paymentStatus: { type: "keyword" },
                    receivedAmount: { type: "keyword" },
                    bankName: { type: "text", analyzer: "standard" },
                    bankAccount: { type: "keyword" },
                    currency: { type: "keyword" },
                    errorCode: { type: "keyword" },
                    errorDescription: { type: "text", analyzer: "standard" },
                    refundedAt: { type: "date" },
                    processedByWebhook: { type: "boolean" },
                    payosMetadata: { type: "text" },
                    sepayMetadata: { type: "text" },
                    created_at: { type: "date" },
                    updated_at: { type: "date" },
                },
            },
        })
        this.logger.log(`Created index ${this.indexName}`)
    }

    async indexDonation(donation: any) {
        try {
            await this.openSearchService.indexDocument({
                index: this.indexName,
                id: donation.id,
                body: {
                    id: donation.id,
                    donorId: donation.donor_id || donation.donorId,
                    donorName: donation.donor_name || donation.donorName,
                    campaignId: donation.campaign_id || donation.campaignId,
                    campaignTitle: donation.campaignTitle || "",
                    amount: donation.amount.toString(),
                    isAnonymous: donation.is_anonymous || donation.isAnonymous,
                    status: donation.status,
                    orderCode: donation.orderCode || "",
                    transactionDatetime: donation.transactionDatetime,
                    description: donation.description || "",
                    gateway: donation.gateway || "UNKNOWN",
                    paymentStatus: donation.paymentStatus || "PENDING",
                    receivedAmount: donation.receivedAmount || "0",
                    bankName: donation.bankName || "",
                    bankAccount: donation.bankAccount || "",
                    currency: donation.currency || "VND",
                    errorCode: donation.errorCode || "",
                    errorDescription: donation.errorDescription || "",
                    refundedAt: donation.refundedAt || null,
                    processedByWebhook: donation.processedByWebhook || false,
                    payosMetadata: donation.payosMetadata ? JSON.stringify(donation.payosMetadata) : "",
                    sepayMetadata: donation.sepayMetadata ? JSON.stringify(donation.sepayMetadata) : "",
                    created_at: donation.created_at,
                    updated_at: donation.updated_at,
                }
            })
            this.logger.log(`Indexed donation ${donation.id}`)
        } catch (error) {
            this.logger.error(`Failed to index donation ${donation.id}`, error)
        }
    }

    async search(input: SearchDonationInput, amountField: string = "amount") {
        const {
            query,
            campaignId,
            status,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            sortBy,
            page = 1,
            limit = 10,
        } = input

        const must: any[] = []

        if (query) {
            must.push({
                multi_match: {
                    query,
                    fields: ["donorName", "orderCode", "campaignTitle", "description", "bankName", "bankAccount", "errorDescription"],
                    fuzziness: "AUTO",
                },
            })
        }

        if (campaignId) {
            must.push({ term: { campaignId } })
        }

        if (status) {
            must.push({ term: { status } })
        }

        if (minAmount || maxAmount) {
            const range: any = {}
            if (minAmount) range.gte = minAmount
            if (maxAmount) range.lte = maxAmount
            must.push({ range: { [amountField]: range } })
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
                ...hit,
            })),
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        }
    }

    async removeDonation(id: string) {
        try {
            await this.openSearchService.deleteDocument(this.indexName, id)
            this.logger.log(`Removed donation ${id} from index`)
        } catch (error) {
            this.logger.error(`Failed to remove donation ${id}`, error)
        }
    }

    async syncAll() {
        this.logger.log("Starting full sync of donations to OpenSearch...")
        let successCount = 0
        let failCount = 0
        const batchSize = 100
        let skip = 0

        while (true) {
            const donations = await this.donorRepository.findAll({
                skip,
                take: batchSize,
            })

            if (donations.length === 0) break

            for (const donation of donations as any[]) {
                try {
                    const transactions = donation.payment_transactions || []
                    // Prioritize SUCCESS, then latest
                    const successTx = transactions.find((t: any) => t.status === "SUCCESS")
                    const latestTx = transactions[transactions.length - 1]
                    const activeTx = successTx || latestTx

                    // Extract bank info from metadata
                    let bankName = ""
                    let bankAccount = ""
                    const gateway = activeTx?.gateway || "UNKNOWN"
                    const paymentStatus = activeTx?.payment_status || "PENDING"
                    const receivedAmount = activeTx?.received_amount?.toString() || "0"
                    const currency = activeTx?.currency || "VND"
                    const errorCode = activeTx?.error_code || ""
                    const errorDescription = activeTx?.error_description || ""
                    const refundedAt = activeTx?.refunded_at || null
                    const processedByWebhook = activeTx?.processed_by_webhook || false
                    const payosMetadata = activeTx?.payos_metadata || null
                    const sepayMetadata = activeTx?.sepay_metadata || null

                    if (activeTx) {
                        if (activeTx.gateway === "PAYOS" && activeTx.payos_metadata) {
                            // payos_metadata is Json, need to cast or access safely
                            const meta = activeTx.payos_metadata as any
                            bankName = meta.counter_account_bank_name || ""
                            bankAccount = meta.counter_account_number || ""
                        } else if (activeTx.gateway === "SEPAY" && activeTx.sepay_metadata) {
                            const meta = activeTx.sepay_metadata as any
                            bankName = meta.bank_name || ""
                            bankAccount = meta.sub_account || "" // Or reference code?
                        }
                    }

                    const mappedDonation: any = {
                        id: donation.id,
                        donorId: donation.donor_id,
                        donorName: donation.donor_name,
                        campaignId: donation.campaign_id,
                        campaignTitle: donation.campaign?.title || "",
                        amount: donation.amount.toString(),
                        isAnonymous: donation.is_anonymous,
                        status: activeTx?.status || "PENDING",
                        orderCode: activeTx?.order_code?.toString() || "",
                        transactionDatetime: activeTx?.created_at || donation.created_at,
                        created_at: donation.created_at,
                        updated_at: donation.updated_at,
                        description: activeTx?.description || "",
                        gateway,
                        paymentStatus,
                        receivedAmount,
                        bankName,
                        bankAccount,
                        currency,
                        errorCode,
                        errorDescription,
                        refundedAt,
                        processedByWebhook,
                        payosMetadata,
                        sepayMetadata,
                    }
                    await this.indexDonation(mappedDonation)
                    successCount++
                } catch (error) {
                    this.logger.error(
                        `Failed to sync donation ${donation.id}`,
                        error,
                    )
                    failCount++
                }
            }

            skip += batchSize
            this.logger.log(`Synced ${successCount} donations so far...`)
        }

        this.logger.log(
            `Sync completed. Success: ${successCount}, Failed: ${failCount}`,
        )
        return { successCount, failCount }
    }
}
