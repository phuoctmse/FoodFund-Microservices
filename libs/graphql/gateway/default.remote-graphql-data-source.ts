import { RemoteGraphQLDataSource } from "@apollo/gateway"
import type { RetryOptions, CircuitBreakerOptions, FallbackOptions, MonitoringOptions } from "./gateway.types"

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface DataSourceOptions {
    url: string
    subgraphName?: string
    retryOptions?: RetryOptions
    circuitBreakerOptions?: CircuitBreakerOptions
    fallback?: FallbackOptions
    monitoring?: MonitoringOptions
}

export class DefaultRemoteGraphQLDataSource extends RemoteGraphQLDataSource {
    private failureCount = 0
    private circuitOpenUntil = 0
    private subgraphName: string
    private retryOptions: Required<RetryOptions>
    private circuitOptions: Required<CircuitBreakerOptions>
    private fallback?: FallbackOptions
    private monitoring?: MonitoringOptions

    constructor(options: DataSourceOptions) {
        super({ url: options.url })
        this.subgraphName = options.subgraphName ?? options.url
        this.retryOptions = {
            retries: options.retryOptions?.retries ?? 2,
            initialDelayMs: options.retryOptions?.initialDelayMs ?? 200,
            maxDelayMs: options.retryOptions?.maxDelayMs ?? 2000,
            factor: options.retryOptions?.factor ?? 2,
        }
        this.circuitOptions = {
            failureThreshold: options.circuitBreakerOptions?.failureThreshold ?? 3,
            resetTimeoutMs: options.circuitBreakerOptions?.resetTimeoutMs ?? 60000,
        }
        this.fallback = options.fallback
        this.monitoring = options.monitoring
    }

    willSendRequest({ request, context }) {
        // Pass the auth token from the context to each subgraph
        const token = context.req?.headers?.authorization
        if (token) {
            request.http.headers.set("authorization", token)
        }
        // set the ip address of the client
        const ip = context.req?.headers?.["x-forwarded-for"]
        if (ip) {
            request.http.headers.set("x-forwarded-for", ip)
        }
    }

    // Override process to add retries, circuit-breaker and fallback handling
    // Use a permissive signature to match RemoteGraphQLDataSource
    async process(options: any) {
        const { request, context, requestPolicy } = options
        // If circuit is open, fast-fail to fallback or throw
        const now = Date.now()
        if (this.circuitOpenUntil > now) {
            this.monitoring?.onEvent?.({ type: "circuitOpen", subgraph: this.subgraphName, details: { until: this.circuitOpenUntil } })
            if (this.fallback?.response) {
                this.monitoring?.onEvent?.({ type: "fallback", subgraph: this.subgraphName, details: { reason: "circuitOpen" } })
                return this.createFallbackResponse(this.fallback.response)
            }
            throw new Error(`Subgraph ${this.subgraphName} circuit is open`)
        }

        // attempt with retries
        let attempt = 0
        let lastError: any = null
        let delay = this.retryOptions.initialDelayMs

        while (attempt <= this.retryOptions.retries) {
            try {
                const result = await super.process(options)

                // if result contains errors from subgraph, propagate but allow partial execution
                if (result.errors && result.errors.length > 0) {
                    // increase failure count but allow partial results to return
                    this.failureCount += 1
                    this.checkOpenCircuit()
                    this.monitoring?.onEvent?.({ type: "subgraphError", subgraph: this.subgraphName, details: { errors: result.errors } })
                    // Return result so gateway can partial-execute other subgraphs
                    return result
                }

                // success -> reset failure count and return
                if (this.failureCount > 0) {
                    this.failureCount = 0
                    this.monitoring?.onEvent?.({ type: "circuitClose", subgraph: this.subgraphName })
                }
                return result
            } catch (err) {
                lastError = err
                attempt += 1
                this.failureCount += 1
                this.monitoring?.onEvent?.({ type: "error", subgraph: this.subgraphName, details: { attempt, error: err } })
                this.checkOpenCircuit()
                if (attempt > this.retryOptions.retries) break
                // backoff
                await wait(Math.min(delay, this.retryOptions.maxDelayMs))
                delay = Math.min(delay * this.retryOptions.factor, this.retryOptions.maxDelayMs)
                this.monitoring?.onEvent?.({ type: "retry", subgraph: this.subgraphName, details: { attempt, nextDelay: delay } })
            }
        }

        // All retries exhausted: either return fallback response or throw to let gateway propagate partial execution
        if (this.fallback?.response) {
            this.monitoring?.onEvent?.({ type: "fallback", subgraph: this.subgraphName, details: { reason: "retries_exhausted" } })
            return this.createFallbackResponse(this.fallback.response)
        }

        // If no fallback, return a GraphQL-shaped error response so Gateway can partial-execute
        const errorMessage = lastError?.message ?? String(lastError ?? `Subgraph ${this.subgraphName} failed`)
        this.monitoring?.onEvent?.({ type: "error", subgraph: this.subgraphName, details: { finalError: errorMessage } })

        const errorResponse = {
            data: null,
            errors: [
                {
                    message: errorMessage,
                    extensions: {
                        code: "SUBGRAPH_UNAVAILABLE",
                        subgraph: this.subgraphName,
                    },
                },
            ],
        }

        return this.createFallbackResponse(errorResponse)
    }

    private checkOpenCircuit() {
        if (this.failureCount >= this.circuitOptions.failureThreshold) {
            this.circuitOpenUntil = Date.now() + this.circuitOptions.resetTimeoutMs
            this.monitoring?.onEvent?.({ type: "circuitOpen", subgraph: this.subgraphName, details: { until: this.circuitOpenUntil } })
        }
    }

    private createFallbackResponse(responseBody: any): any {
        // Minimal Response shape that Apollo Gateway expects from a subgraph.
        // Ensure body is a string (HTTP body) so the gateway can parse it.
        const body = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)
        // Return a minimal object that the gateway can interpret as an HTTP-like response.
        return { body, headers: new Map<string, string>(), status: 200 }
    }
}
