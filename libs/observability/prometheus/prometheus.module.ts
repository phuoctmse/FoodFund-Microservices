import { Module } from "@nestjs/common"
import {
    PrometheusModule as NestPrometheusModule,
    makeCounterProvider,
    makeHistogramProvider,
    makeGaugeProvider,
} from "@willsoto/nestjs-prometheus"
import { PrometheusService } from "./prometheus.service"
import { PrometheusInterceptor } from "./prometheus.interceptor"

/**
 * Prometheus Monitoring Module
 *
 * Provides metrics collection for:
 * - HTTP requests (total, duration, errors)
 * - gRPC calls (total, duration, errors)
 * - System metrics (memory, CPU, event loop)
 *
 * Exposes /metrics endpoint for Prometheus scraping
 */
@Module({
    imports: [
        NestPrometheusModule.register({
            // Expose metrics at /metrics endpoint
            path: "/metrics",

            // Enable default Node.js metrics
            defaultMetrics: {
                enabled: true,
                // Collect metrics every 10 seconds
                config: {
                    prefix: "foodfund_",
                },
            },

            // Registry configuration
            defaultLabels: {
                app: process.env.SERVICE_NAME || "foodfund-service",
                environment: process.env.NODE_ENV || "development",
            },
        }),
    ],
    providers: [
        // HTTP Metrics
        makeCounterProvider({
            name: "http_requests_total",
            help: "Total number of HTTP requests",
            labelNames: ["method", "path", "status", "service"],
        }),
        makeHistogramProvider({
            name: "http_request_duration_seconds",
            help: "HTTP request duration in seconds",
            labelNames: ["method", "path", "status", "service"],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        }),
        makeCounterProvider({
            name: "http_request_errors_total",
            help: "Total number of HTTP request errors",
            labelNames: ["method", "path", "status", "service", "error_type"],
        }),

        // gRPC Metrics
        makeCounterProvider({
            name: "grpc_requests_total",
            help: "Total number of gRPC requests",
            labelNames: ["method", "service", "status"],
        }),
        makeHistogramProvider({
            name: "grpc_request_duration_seconds",
            help: "gRPC request duration in seconds",
            labelNames: ["method", "service", "status"],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
        }),
        makeCounterProvider({
            name: "grpc_request_errors_total",
            help: "Total number of gRPC request errors",
            labelNames: ["method", "service", "error_code"],
        }),

        // Database Metrics
        makeHistogramProvider({
            name: "db_query_duration_seconds",
            help: "Database query duration in seconds",
            labelNames: ["operation", "model", "service"],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
        }),
        makeGaugeProvider({
            name: "db_connections_active",
            help: "Number of active database connections",
            labelNames: ["service", "database"],
        }),

        PrometheusService,
        PrometheusInterceptor,
    ],
    exports: [PrometheusService, PrometheusInterceptor],
})
export class PrometheusModule {}
