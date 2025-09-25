export interface GraphqlGatewayOptions {
    subgraphs: Array<SubgraphConfig>
    // Global defaults for retry/circuit/fallback/monitoring. Can be overridden per-subgraph.
    retryOptions?: RetryOptions
    circuitBreakerOptions?: CircuitBreakerOptions
    monitoring?: MonitoringOptions
    // Optional global fallback when a subgraph is unavailable
    fallback?: FallbackOptions
    // Gateway initialization retry options
    gatewayRetryOptions?: GatewayRetryOptions
}

export interface SubgraphConfig {
    name: string
    url: string
    // Optional per-subgraph overrides
    retryOptions?: RetryOptions
    circuitBreakerOptions?: CircuitBreakerOptions
    fallback?: FallbackOptions
}

export interface RetryOptions {
    retries?: number // number of retry attempts (default: 2)
    initialDelayMs?: number // initial backoff delay (default: 200)
    maxDelayMs?: number // max backoff delay (default: 2000)
    factor?: number // exponential backoff factor (default: 2)
}

export interface CircuitBreakerOptions {
    failureThreshold?: number // number of consecutive failures before opening (default: 3)
    resetTimeoutMs?: number // time to close circuit after opened (default: 60_000)
}

export interface FallbackOptions {
    // static response to return when the subgraph is unavailable. If omitted, a GraphQL error is propagated
    response?: any
}

export interface MonitoringOptions {
    // simple hook to surface events (retry, open, close, fallback, error)
    onEvent?: (event: {
        type:
            | "retry"
            | "circuitOpen"
            | "circuitClose"
            | "fallback"
            | "error"
            | "subgraphError"
        subgraph: string
        details?: any
    }) => void
}

export interface GatewayRetryOptions {
    maxRetries?: number // number of retry attempts for gateway initialization (default: 5)
    initialDelayMs?: number // initial backoff delay for gateway initialization (default: 1000)
    maxDelayMs?: number // max backoff delay for gateway initialization (default: 10000)
    factor?: number // exponential backoff factor for gateway initialization (default: 2)
}
