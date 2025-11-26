import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { OpenSearchService } from "@libs/aws-opensearch"
import { Campaign } from "../../../domain/entities/campaign.model"
import { CampaignSortBy, SearchCampaignInput } from "../../dtos/campaign/request/search-campaign.input"
import { CampaignStatus } from "../../../domain/enums/campaign/campaign.enum"
import { CampaignRepository } from "../../repositories/campaign.repository"

@Injectable()
export class CampaignSearchService implements OnModuleInit {
    private readonly logger = new Logger(CampaignSearchService.name)
    private readonly indexName = "campaigns"

    constructor(
        private readonly openSearchService: OpenSearchService,
        private readonly campaignRepository: CampaignRepository,
    ) { }

    async onModuleInit() {
        try {
            await this.createIndexIfNotExists()

            // Debug: Check document count
            const count = await this.openSearchService.count(this.indexName)
            this.logger.log(`Current document count in '${this.indexName}': ${count}`)
        } catch (error) {
            this.logger.warn(
                `Failed to initialize OpenSearch index. This might be due to missing permissions. Search functionality may be degraded. Error: ${error.message}`,
            )
        }
    }

    private async createIndexIfNotExists() {
        const exists = await this.openSearchService.indexExists(this.indexName)
        if (exists) return

        const mappings = {
            properties: {
                id: { type: "keyword" },
                title: { type: "text", analyzer: "standard" },
                description: { type: "text", analyzer: "standard" },
                categoryId: { type: "keyword" },
                creatorId: { type: "keyword" },
                status: { type: "keyword" },
                targetAmount: { type: "double" },
                receivedAmount: { type: "double" },
                donationCount: { type: "integer" },
                fundingProgress: { type: "float" },
                fundraisingStartDate: { type: "date" },
                fundraisingEndDate: { type: "date" },
                createdAt: { type: "date" },
                coverImage: { type: "keyword" },
                slug: { type: "keyword" },
                category: {
                    properties: {
                        id: { type: "keyword" },
                        title: { type: "text" },
                    },
                },
                phases: {
                    properties: {
                        location: { type: "text" },
                    },
                },
            },
        }

        await this.openSearchService.createIndex(this.indexName, mappings)
        this.logger.log(`Index ${this.indexName} created`)
    }

    async indexCampaign(campaign: Campaign) {
        try {
            const body = {
                id: campaign.id,
                title: campaign.title,
                description: campaign.description,
                categoryId: campaign.categoryId,
                creatorId: campaign.createdBy,
                status: campaign.status,
                targetAmount: parseFloat(campaign.targetAmount),
                receivedAmount: parseFloat(campaign.receivedAmount),
                donationCount: campaign.donationCount,
                fundingProgress: campaign.fundingProgress,
                fundraisingStartDate: campaign.fundraisingStartDate,
                fundraisingEndDate: campaign.fundraisingEndDate,
                createdAt: campaign.created_at,
                coverImage: campaign.coverImage,
                category: campaign.category
                    ? {
                        id: campaign.category.id,
                        title: campaign.category.title,
                    }
                    : null,
                phases: campaign.phases?.map((p) => ({
                    location: p.location,
                })) || [],
            }

            await this.openSearchService.indexDocument({
                index: this.indexName,
                id: campaign.id,
                body,
            })
            this.logger.log(`Indexed campaign ${campaign.id}`)
        } catch (error) {
            this.logger.error(`Failed to index campaign ${campaign.id}`, error)
        }
    }

    async removeCampaign(campaignId: string) {
        try {
            await this.openSearchService.deleteDocument(this.indexName, campaignId)
            this.logger.log(`Removed campaign ${campaignId} from index`)
        } catch (error) {
            this.logger.error(`Failed to remove campaign ${campaignId}`, error)
        }
    }

    async search(input: SearchCampaignInput) {
        const {
            query,
            categoryId,
            creatorId,
            status,
            minTargetAmount,
            maxTargetAmount,
            sortBy,
            page = 1,
            limit = 10,
        } = input

        const must: any[] = []
        const filter: any[] = []

        if (query) {
            must.push({
                multi_match: {
                    query,
                    fields: ["title^3", "description", "category.title", "phases.location"],
                    fuzziness: "AUTO",
                },
            })
        } else {
            must.push({ match_all: {} })
        }

        if (categoryId) {
            filter.push({ term: { categoryId } })
        }

        if (creatorId) {
            filter.push({ term: { creatorId } })
        }

        if (status && status.length > 0) {
            filter.push({ terms: { status } })
        }

        if (minTargetAmount !== undefined || maxTargetAmount !== undefined) {
            const range: any = {}
            if (minTargetAmount !== undefined) range.gte = minTargetAmount
            if (maxTargetAmount !== undefined) range.lte = maxTargetAmount
            filter.push({ range: { targetAmount: range } })
        }

        const sort: any[] = []
        if (sortBy) {
            switch (sortBy) {
            case CampaignSortBy.NEWEST:
            case CampaignSortBy.NEWEST_FIRST:
                sort.push({ createdAt: "desc" })
                break
            case CampaignSortBy.OLDEST:
            case CampaignSortBy.OLDEST_FIRST:
                sort.push({ createdAt: "asc" })
                break
            case CampaignSortBy.MOST_FUNDED:
                sort.push({ fundingProgress: "desc" })
                break
            case CampaignSortBy.LEAST_FUNDED:
                sort.push({ fundingProgress: "asc" })
                break
            case CampaignSortBy.ENDING_SOON:
                sort.push({ fundraisingEndDate: "asc" })
                break
            case CampaignSortBy.TARGET_AMOUNT_ASC:
                sort.push({ targetAmount: "asc" })
                break
            case CampaignSortBy.TARGET_AMOUNT_DESC:
                sort.push({ targetAmount: "desc" })
                break
            case CampaignSortBy.MOST_DONATED:
                sort.push({ donationCount: "desc" })
                break
            case CampaignSortBy.LEAST_DONATED:
                sort.push({ donationCount: "asc" })
                break
            case CampaignSortBy.ACTIVE_FIRST:
                sort.push({ status: "asc" })
                sort.push({ createdAt: "desc" })
                break
            }
        } else {
            sort.push({ createdAt: "desc" })
        }

        const from = (page - 1) * limit

        const result = await this.openSearchService.search({
            index: this.indexName,
            query: {
                bool: {
                    must,
                    filter,
                },
            },
            from,
            size: limit,
            sort,
        })

        return {
            items: result.hits.map((hit: any) => {
                const now = new Date()
                const endDate = new Date(hit.fundraisingEndDate)
                const diffTime = endDate.getTime() - now.getTime()
                const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                return {
                    ...hit,
                    targetAmount: hit.targetAmount.toString(),
                    receivedAmount: hit.receivedAmount.toString(),
                    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                    creator: {
                        __typename: "User",
                        id: hit.creatorId,
                    },
                    category: hit.category,
                    phases: hit.phases,
                    fundraisingStartDate: hit.fundraisingStartDate,
                }
            }),
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        }
    }

    async syncAll() {
        this.logger.log("Starting full sync of campaigns to OpenSearch...")
        const allCampaigns = await this.campaignRepository.findAll()
        this.logger.log(`Found ${allCampaigns.length} campaigns to sync`)

        let successCount = 0
        let failCount = 0

        for (const campaign of allCampaigns) {
            try {
                await this.indexCampaign(campaign)
                successCount++
            } catch (error) {
                this.logger.error(`Failed to sync campaign ${campaign.id}`, error)
                failCount++
            }
        }

        this.logger.log(
            `Sync completed. Success: ${successCount}, Failed: ${failCount}`,
        )
        return { successCount, failCount }
    }
}
