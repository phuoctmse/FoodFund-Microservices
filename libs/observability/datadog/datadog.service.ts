import { Injectable, Inject, Logger } from "@nestjs/common"
import { StatsD } from "hot-shots"
import { envConfig } from "@libs/env"

export interface DatadogOptions {
    serviceName: string
    env: string
    version: string
}

/**
 * Datadog Service
 *
 * Provides methods to send custom metrics to Datadog
 * Replaces PrometheusService functionality
 */
@Injectable()
export class DatadogService {
    private readonly logger = new Logger(DatadogService.name)
    private statsD: StatsD

    constructor(
        @Inject("DATADOG_OPTIONS") private readonly options: DatadogOptions,
    ) {
        // Initialize DogStatsD client
        // Support both local and Kubernetes environments
        const config = envConfig()
        const datadogHost = config.datadog.agentHost
        const datadogPort = config.datadog.agentPort
        const isTracingEnabled = config.datadog.traceEnabled

        this.statsD = new StatsD({
            host: datadogHost,
            port: datadogPort,
            globalTags: {
                service: this.options.serviceName,
                env: this.options.env,
                version: this.options.version,
            },
            // Gracefully handle connection errors
            errorHandler: (error) => {
                if (!isTracingEnabled) {
                    // Silently ignore errors when tracing is disabled
                    return
                }
                this.logger.warn(
                    `⚠️  DogStatsD connection error: ${error.message}`,
                )
            },
        })

        this.logger.log(
            `✅ Datadog service initialized for ${this.options.serviceName}`,
        )

        if (isTracingEnabled) {
            this.logger.log(
                `📡 DogStatsD connecting to ${datadogHost}:${datadogPort}`,
            )
        } else {
            this.logger.log(
                "⚠️  DataDog tracing is disabled (DD_TRACE_ENABLED=false)",
            )
        }
    }

    /**
     * Record HTTP request metrics
     * Replaces PrometheusService.recordHttpRequest()
     */
    recordHttpRequest(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
    ) {
        const status = statusCode.toString()
        const tags = { method, path, status }

        // Total requests counter
        this.statsD.increment("foodfund.http.requests.total", 1, tags)

        // Request duration histogram
        this.statsD.histogram("foodfund.http.request.duration", duration, tags)

        // Error counter
        if (statusCode >= 400) {
            const errorType =
                statusCode >= 500 ? "server_error" : "client_error"
            this.statsD.increment("foodfund.http.request.errors.total", 1, {
                ...tags,
                error_type: errorType,
            })
        }
    }

    /**
     * Record gRPC request metrics
     * Replaces PrometheusService.recordGrpcRequest()
     */
    recordGrpcRequest(
        method: string,
        status: string,
        duration: number,
        error?: Error,
    ) {
        const tags = { method, status }

        // Total gRPC requests
        this.statsD.increment("foodfund.grpc.requests.total", 1, tags)

        // gRPC duration
        this.statsD.histogram("foodfund.grpc.request.duration", duration, tags)

        // gRPC errors
        if (error || status !== "OK") {
            this.statsD.increment("foodfund.grpc.request.errors.total", 1, {
                ...tags,
                error_code: status,
            })
        }
    }

    /**
     * Record database query metrics
     * Replaces PrometheusService.recordDbQuery()
     */
    recordDbQuery(operation: string, model: string, duration: number) {
        const tags = { operation, model }

        // Database query duration
        this.statsD.histogram("foodfund.db.query.duration", duration, tags)
    }

    /**
     * Record database connection metrics
     * Replaces PrometheusService.recordDbConnections()
     */
    recordDbConnections(count: number, database: string) {
        this.statsD.gauge("foodfund.db.connections.active", count, { database })
    }

    /**
     * Record GraphQL operation metrics
     */
    recordGraphqlOperation(
        operationName: string,
        operationType: string,
        duration: number,
        hasErrors: boolean,
    ) {
        const tags = {
            operation_name: operationName,
            operation_type: operationType,
        }

        // GraphQL operations counter
        this.statsD.increment("foodfund.graphql.operations.total", 1, tags)

        // GraphQL operation duration
        this.statsD.histogram(
            "foodfund.graphql.operation.duration",
            duration,
            tags,
        )

        // GraphQL errors
        if (hasErrors) {
            this.statsD.increment(
                "foodfund.graphql.operation.errors.total",
                1,
                tags,
            )
        }
    }

    /**
     * Record business metrics
     */
    recordBusinessMetric(
        metricName: string,
        value: number,
        tags?: Record<string, string>,
    ) {
        this.statsD.histogram(`foodfund.business.${metricName}`, value, tags)
    }

    /**
     * Increment business counter
     */
    incrementBusinessCounter(
        metricName: string,
        tags?: Record<string, string>,
    ) {
        this.statsD.increment(`foodfund.business.${metricName}`, 1, tags)
    }

    /**
     * Record business gauge
     */
    recordBusinessGauge(
        metricName: string,
        value: number,
        tags?: Record<string, string>,
    ) {
        this.statsD.gauge(`foodfund.business.${metricName}`, value, tags)
    }

    /**
     * Custom metric for any use case
     */
    recordCustomMetric(
        metricName: string,
        value: number,
        type: "counter" | "histogram" | "gauge" = "histogram",
        tags?: Record<string, string>,
    ) {
        const fullMetricName = `foodfund.custom.${metricName}`

        switch (type) {
        case "counter":
            this.statsD.increment(fullMetricName, value, tags)
            break
        case "histogram":
            this.statsD.histogram(fullMetricName, value, tags)
            break
        case "gauge":
            this.statsD.gauge(fullMetricName, value, tags)
            break
        }
    }

    /**
     * Close StatsD connection (for graceful shutdown)
     */
    async close(): Promise<void> {
        return new Promise((resolve) => {
            this.statsD.close(() => {
                this.logger.log("Datadog StatsD connection closed")
                resolve()
            })
        })
    }
}
