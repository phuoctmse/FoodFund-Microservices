import { Injectable, Logger } from "@nestjs/common"
import { Counter, Histogram, Gauge } from "prom-client"
import { InjectMetric } from "@willsoto/nestjs-prometheus"

/**
 * Prometheus Metrics Service
 *
 * Provides methods to record custom metrics for:
 * - HTTP requests (automatically tracked by interceptor)
 * - gRPC calls
 * - Database operations
 */
@Injectable()
export class PrometheusService {
    private readonly logger = new Logger(PrometheusService.name)

    constructor(
        // HTTP Metrics (tracked by interceptor)
        @InjectMetric("http_requests_total")
        public httpRequestsTotal: Counter<string>,

        @InjectMetric("http_request_duration_seconds")
        public httpRequestDuration: Histogram<string>,

        @InjectMetric("http_request_errors_total")
        public httpRequestErrors: Counter<string>,

        // gRPC Metrics
        @InjectMetric("grpc_requests_total")
        public grpcRequestsTotal: Counter<string>,

        @InjectMetric("grpc_request_duration_seconds")
        public grpcRequestDuration: Histogram<string>,

        @InjectMetric("grpc_request_errors_total")
        public grpcRequestErrors: Counter<string>,

        // Database Metrics
        @InjectMetric("db_query_duration_seconds")
        public dbQueryDuration: Histogram<string>,

        @InjectMetric("db_connections_active")
        public dbConnectionsActive: Gauge<string>,
    ) {
        this.logger.log("✅ Prometheus metrics service initialized")
    }

    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        service: string,
    ) {
        const status = statusCode.toString()

        this.httpRequestsTotal.inc({ method, path, status, service })
        this.httpRequestDuration.observe({ method, path, status, service }, duration)

        if (statusCode >= 400) {
            const errorType = statusCode >= 500 ? "server_error" : "client_error"
            this.httpRequestErrors.inc({ method, path, status, service, error_type: errorType })
        }
    }

    /**
     * Record gRPC request metrics
     */
    recordGrpcRequest(
        method: string,
        service: string,
        status: string,
        duration: number,
        error?: Error,
    ) {
        this.grpcRequestsTotal.inc({ method, service, status })
        this.grpcRequestDuration.observe({ method, service, status }, duration)

        if (error) {
            this.grpcRequestErrors.inc({
                method,
                service,
                error_code: error.name || "UNKNOWN",
            })
        }
    }

    /**
     * Record database query metrics
     */
    recordDatabaseQuery(operation: string, model: string, service: string, duration: number) {
        this.dbQueryDuration.observe({ operation, model, service }, duration)
    }

    /**
     * Update active database connections
     */
    updateDatabaseConnections(service: string, database: string, count: number) {
        this.dbConnectionsActive.set({ service, database }, count)
    }
}
