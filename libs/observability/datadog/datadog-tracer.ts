/**
 * DataDog APM Tracer Initialization Module
 *
 * This module provides a centralized way to initialize DataDog APM tracer
 * for all microservices.
 *
 * IMPORTANT: This module must be imported FIRST in main.ts before any other imports
 * to enable distributed tracing for all HTTP, GraphQL, gRPC, and Database calls
 */

import tracer from "dd-trace"
import { envConfig } from "@libs/env"

export interface DatadogTracerOptions {
    /**
     * Service name (e.g., 'campaign-service', 'user-service')
     * Will be overridden by DD_SERVICE env var if set
     */
    serviceName: string

    /**
     * Service type tag (e.g., 'backend', 'gateway')
     */
    serviceType?: string

    /**
     * Microservice identifier for tagging
     */
    microservice?: string

    /**
     * Additional custom tags
     */
    tags?: Record<string, string>
}

/**
 * Initialize DataDog APM Tracer
 *
 * @param options - Configuration options for the tracer
 * @returns The initialized tracer instance
 *
 * @example
 * ```typescript
 * // In main.ts (must be FIRST import)
 * import { initDatadogTracer } from '@libs/observability/datadog'
 *
 * initDatadogTracer({
 *   serviceName: 'campaign-service',
 *   serviceType: 'backend',
 *   microservice: 'campaign'
 * })
 *
 * // Then import other modules
 * import { NestFactory } from '@nestjs/core'
 * // ...
 * ```
 */
export function initDatadogTracer(
    options: DatadogTracerOptions,
): typeof tracer {
    const env = envConfig()
    const isTracingEnabled = env.datadog.traceEnabled

    if (!isTracingEnabled) {
        console.log(
            `⚠️  DataDog APM Tracing is disabled for ${options.serviceName} (DD_TRACE_ENABLED=false)`,
        )
        return tracer
    }

    const {
        serviceName,
        serviceType = "backend",
        microservice,
        tags = {},
    } = options

    tracer.init({
        service: serviceName,

        // Environment - production, staging, development
        env: env.datadog.env || process.env.NODE_ENV || "development",

        // Version for tracking deployments
        version: env.datadog.version,

        // DataDog Agent host and port
        hostname: env.datadog.agentHost,
        port: env.datadog.agentPort.toString(),

        // Enable runtime metrics
        runtimeMetrics: true,

        // Enable logs injection (correlate logs with traces)
        logInjection: env.datadog.logsInjection,

        // Enable profiling
        profiling: true,

        // Sampling rate (1.0 = 100%, 0.5 = 50%)
        sampleRate: env.datadog.traceSampleRate,

        // Plugin configurations - auto-instrument all supported libraries
        plugins: true,

        // Tags to add to all traces
        tags: {
            team: "foodfund",
            service_type: serviceType,
            ...(microservice && { microservice }),
            ...tags,
        },
    })

    console.log(`✅ DataDog APM Tracer initialized for ${serviceName}`)
    console.log(
        `📡 Connecting to APM Agent at ${env.datadog.agentHost}:${env.datadog.agentPort}`,
    )
    console.log(
        `🏷️  Environment: ${env.datadog.env || process.env.NODE_ENV || "development"}`,
    )

    return tracer
}

/**
 * Get the current tracer instance
 * Useful for creating custom spans
 *
 * @example
 * ```typescript
 * import { getTracer } from '@libs/observability/datadog'
 *
 * const tracer = getTracer()
 * const span = tracer.startSpan('custom.operation')
 * // ... do work
 * span.finish()
 * ```
 */
export function getTracer(): typeof tracer {
    return tracer
}

// Re-export the tracer for direct access if needed
export { tracer }
export default tracer
