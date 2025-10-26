import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Client } from "@opensearch-project/opensearch"
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws"
import { defaultProvider } from "@aws-sdk/credential-provider-node"
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types"
import { envConfig } from "@libs/env"

export interface SearchOptions {
    index: string
    query: any
    from?: number
    size?: number
    sort?: any[]
}

export interface IndexDocumentOptions {
    index: string
    id?: string
    body: any
    refresh?: boolean | "wait_for"
}

export interface BulkIndexOptions {
    index: string
    documents: Array<{ id?: string; body: any }>
    refresh?: boolean | "wait_for"
}

@Injectable()
export class OpenSearchService implements OnModuleInit {
    private readonly logger = new Logger(OpenSearchService.name)
    private client: Client | null = null
    // credential provider can be async; keep reference for signer
    private credentialsProvider: AwsCredentialIdentityProvider | null = null

    constructor() {}

    async onModuleInit() {
        const env = envConfig()
        const endpoint = env.aws.awsOpenSearchEndpoint
        const region = env.aws.region

        if (!endpoint) {
            this.logger.warn(
                "AWS_OPENSEARCH_ENDPOINT not configured. OpenSearch will not be available.",
            )
            return
        }

        try {
            const accessKeyId = env.aws.accessKeyId
            const secretAccessKey = env.aws.secretAccessKey

            if (accessKeyId && secretAccessKey) {
                this.logger.log("Using explicit AWS credentials from config")
                this.credentialsProvider = async () => ({
                    accessKeyId,
                    secretAccessKey,
                } as any)
            } else {
                this.logger.log("Using AWS default credential provider chain")
                this.credentialsProvider = defaultProvider()
            }

            // Build client using AwsSigv4Signer which accepts an async credential provider
            this.client = new Client({
                ...AwsSigv4Signer({
                    region,
                    service: "es",
                    // @ts-expect-error allow async credentials provider for AwsSigv4Signer
                    credentials: this.credentialsProvider as AwsCredentialIdentityProvider,
                }),
                node: endpoint,
                requestTimeout: 60000,
                ssl: { rejectUnauthorized: true },
            })

            this.logger.log(`OpenSearch client initialized for endpoint: ${endpoint}`)
        } catch (error) {
            this.logger.error("Failed to initialize OpenSearch client", error)
            this.logger.warn(
                "OpenSearch will not be available. Service will continue without search functionality.",
            )
            this.client = null
        }
    }

    getClient(): Client {
        if (!this.client) {
            throw new Error("OpenSearch client not initialized or unavailable")
        }
        return this.client
    }

    isAvailable(): boolean {
        return this.client !== null
    }

    async search<T = any>(
        options: SearchOptions,
    ): Promise<{ hits: T[]; total: number }> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, returning empty results")
            return { hits: [], total: 0 }
        }

        const { index, query, from = 0, size = 10, sort } = options

        try {
            const response = await this.client!.search({
                index,
                body: {
                    query,
                    from,
                    size,
                    ...(sort && { sort }),
                },
            })

            const hits = response.body.hits.hits.map((hit: any) => ({
                ...hit._source,
                _id: hit._id,
                _score: hit._score,
            }))

            const total =
                typeof response.body.hits.total === "object"
                    ? response.body.hits.total.value || 0
                    : response.body.hits.total || 0

            return { hits, total }
        } catch (error: any) {
            this.logger.error(`Search error in index ${index}`, error.message)
            
            // Return empty results instead of throwing for permission errors
            if (error.statusCode === 403) {
                this.logger.warn(`Access denied for search in index ${index}. Returning empty results.`)
                return { hits: [], total: 0 }
            }
            
            // For other errors, still throw
            throw error
        }
    }

    async indexDocument(options: IndexDocumentOptions): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping document indexing")
            return null
        }

        const { index, id, body, refresh = false } = options

        try {
            const response = await this.client!.index({
                index,
                id,
                body,
                refresh,
            })

            return response.body
        } catch (error: any) {
            this.logger.error(`Index document error in ${index}`, error.message)
            
            // Handle permission errors gracefully
            if (error.statusCode === 403) {
                this.logger.warn(`Access denied for indexing in ${index}. Operation skipped.`)
                return null
            }
            
            throw error
        }
    }

    async bulkIndex(options: BulkIndexOptions): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping bulk indexing")
            return null
        }

        const { index, documents, refresh = false } = options

        const body = documents.flatMap((doc) => [
            { index: { _index: index, ...(doc.id && { _id: doc.id }) } },
            doc.body,
        ])

        try {
            const response = await this.client!.bulk({
                body,
                refresh,
            })

            if (response.body.errors) {
                const erroredDocuments = response.body.items.filter(
                    (item: any) => item.index?.error,
                )
                this.logger.error(
                    `Bulk index errors: ${erroredDocuments.length} documents failed`,
                )
            }

            return response.body
        } catch (error) {
            this.logger.error("Bulk index error", error)
            throw error
        }
    }

    async updateDocument(
        index: string,
        id: string,
        body: any,
        refresh: boolean | "wait_for" = false,
    ): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping document update")
            return null
        }

        try {
            const response = await this.client!.update({
                index,
                id,
                body: { doc: body },
                refresh,
            })

            return response.body
        } catch (error) {
            this.logger.error(`Update document error in ${index}`, error)
            throw error
        }
    }

    async deleteDocument(
        index: string,
        id: string,
        refresh: boolean | "wait_for" = false,
    ): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping document deletion")
            return null
        }

        try {
            const response = await this.client!.delete({
                index,
                id,
                refresh,
            })

            return response.body
        } catch (error) {
            this.logger.error(`Delete document error in ${index}`, error)
            throw error
        }
    }

    async createIndex(
        index: string,
        mappings?: any,
        settings?: any,
    ): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping index creation")
            return null
        }

        try {
            const response = await this.client!.indices.create({
                index,
                body: {
                    ...(settings && { settings }),
                    ...(mappings && { mappings }),
                },
            })

            this.logger.log(`Index ${index} created successfully`)
            return response.body
        } catch (error) {
            this.logger.error(`Create index error for ${index}`, error)
            throw error
        }
    }

    async indexExists(index: string): Promise<boolean> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, returning false for index existence")
            return false
        }

        try {
            const response = await this.client!.indices.exists({ index })
            return response.body
        } catch (error) {
            return false
        }
    }

    async deleteIndex(index: string): Promise<any> {
        if (!this.isAvailable()) {
            this.logger.warn("OpenSearch not available, skipping index deletion")
            return null
        }

        try {
            const response = await this.client!.indices.delete({ index })
            this.logger.log(`Index ${index} deleted successfully`)
            return response.body
        } catch (error) {
            this.logger.error(`Delete index error for ${index}`, error)
            throw error
        }
    }
}
