import * as winston from "winston"
import { envConfig, isProduction } from "@libs/env"
import tracer from "dd-trace"

const { combine, timestamp, json, errors } = winston.format

const ddTraceFormat = winston.format((info) => {
    const span = tracer.scope().active()
    if (span) {
        const traceId = span.context().toTraceId()
        const spanId = span.context().toSpanId()
        info.dd = {
            ...(info.dd || {}),
            trace_id: traceId,
            span_id: spanId,
        }
    }
    return info
})

export function createWinstonLogger(serviceName: string): winston.Logger {
    const env = envConfig()

    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: combine(
            errors({ stack: true }),
            ddTraceFormat(), // Add Datadog trace context
            timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
            json(),
        ),
        defaultMeta: {
            service: serviceName,
            env: env.datadog.env || env.nodeEnv || "development",
            version: env.datadog.version || "1.0.0",
        },
        transports: [
            new winston.transports.Console({
                // In production, output pure JSON for Datadog
                // In development, could use colorize for readability
                format: isProduction()
                    ? json()
                    : combine(
                        winston.format.colorize(),
                        winston.format.simple(),
                    ),
            }),
        ],
    })
}
