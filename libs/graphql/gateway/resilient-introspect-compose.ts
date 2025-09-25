import { IntrospectAndCompose } from "@apollo/gateway"

export interface GatewayInitRetryOptions {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    factor?: number
}

export interface ResilientIntrospectAndComposeOptions {
    subgraphs: Array<{
        name: string
        url: string
    }>
    introspectionHeaders?: Record<string, string>
    pollIntervalInMs?: number
    retryOptions?: GatewayInitRetryOptions
    onSubgraphUnavailable?: (subgraphName: string, error: Error) => void
}

export class ResilientIntrospectAndCompose {
    private retryOptions: Required<GatewayInitRetryOptions>
    private onSubgraphUnavailable?: (subgraphName: string, error: Error) => void
    private originalSubgraphs: Array<{ name: string; url: string }>
    private introspectionHeaders: Record<string, string>
    private pollIntervalInMs: number

    constructor(options: ResilientIntrospectAndComposeOptions) {
        this.retryOptions = {
            maxRetries: options.retryOptions?.maxRetries ?? 5,
            initialDelayMs: options.retryOptions?.initialDelayMs ?? 1000,
            maxDelayMs: options.retryOptions?.maxDelayMs ?? 10000,
            factor: options.retryOptions?.factor ?? 2,
        }

        this.onSubgraphUnavailable = options.onSubgraphUnavailable
        this.originalSubgraphs = options.subgraphs
        this.introspectionHeaders = options.introspectionHeaders || {}
        this.pollIntervalInMs = options.pollIntervalInMs || 30000
    }

    async createSupergraphManager(): Promise<IntrospectAndCompose> {
        const availableSubgraphs = await this.findAvailableSubgraphs()
        
        if (availableSubgraphs.length === 0) {
            throw new Error("No subgraphs are available after retries. Cannot start gateway.")
        }

        console.log(`🚀 Starting gateway with ${availableSubgraphs.length}/${this.originalSubgraphs.length} available subgraphs`)
        console.log(`📋 Available: ${availableSubgraphs.map(s => s.name).join(", ")}`)

        const unavailableSubgraphs = this.originalSubgraphs.filter(
            original => !availableSubgraphs.some(available => available.name === original.name)
        )

        if (unavailableSubgraphs.length > 0) {
            console.log(`⚠️  Unavailable: ${unavailableSubgraphs.map(s => s.name).join(", ")}`)
            console.log("🔄 Gateway will continue checking unavailable subgraphs in background")
        }

        return new IntrospectAndCompose({
            subgraphs: availableSubgraphs,
            introspectionHeaders: this.introspectionHeaders,
            pollIntervalInMs: this.pollIntervalInMs,
        })
    }

    private async findAvailableSubgraphs(): Promise<Array<{ name: string; url: string }>> {
        const availableSubgraphs: Array<{ name: string; url: string }> = []

        for (const subgraph of this.originalSubgraphs) {
            const isAvailable = await this.tryConnectWithRetry(subgraph)
            if (isAvailable) {
                availableSubgraphs.push(subgraph)
                console.log(`✅ Subgraph "${subgraph.name}" is available`)
            } else {
                const error = new Error(`Failed to connect to subgraph "${subgraph.name}" at ${subgraph.url}`)
                console.warn(`❌ Subgraph "${subgraph.name}" is unavailable`)
                this.onSubgraphUnavailable?.(subgraph.name, error)
            }
        }

        return availableSubgraphs
    }

    private async tryConnectWithRetry(subgraph: { name: string; url: string }): Promise<boolean> {
        let attempt = 0
        let delay = this.retryOptions.initialDelayMs

        while (attempt <= this.retryOptions.maxRetries) {
            try {
                console.log(`🔄 Checking "${subgraph.name}" (attempt ${attempt + 1}/${this.retryOptions.maxRetries + 1})`)
                
                const response = await fetch(subgraph.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...this.introspectionHeaders,
                    },
                    body: JSON.stringify({
                        query: `
                            query IntrospectionQuery {
                                __schema {
                                    queryType { name }
                                    mutationType { name }
                                    subscriptionType { name }
                                }
                            }
                        `,
                    }),
                })

                if (response.ok) {
                    const result = await response.json()
                    if (!result.errors || result.errors.length === 0) {
                        return true
                    }
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            } catch (error) {
                attempt++
                
                if (attempt > this.retryOptions.maxRetries) {
                    console.log(`❌ Failed to connect to "${subgraph.name}" after ${this.retryOptions.maxRetries + 1} attempts`)
                    break
                }
                
                console.log(`⏳ Retrying "${subgraph.name}" in ${delay}ms...`)
                await this.wait(delay)
                delay = Math.min(delay * this.retryOptions.factor, this.retryOptions.maxDelayMs)
            }
        }

        return false
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}