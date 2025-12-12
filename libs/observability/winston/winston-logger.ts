import * as winston from "winston"
import { envConfig, isProduction } from "@libs/env"
import tracer from "dd-trace"
import formats from "dd-trace/ext/formats"

const { combine, timestamp, json, errors } = winston.format

const ddLogInjectionFormat = winston.format((info) => {
    const span = tracer.scope().active()
    if (span) {
        tracer.inject(span.context(), formats.LOG, info)
    }
    return info
})

export function createWinstonLogger(serviceName: string): winston.Logger {
    const env = envConfig()

    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: combine(
            errors({ stack: true }),
            ddLogInjectionFormat(),
            timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
            json(),
        ),
        defaultMeta: {
            service: serviceName,
            env: env.datadog.env || env.nodeEnv || "development",
            version: env.datadog.version || "1.0.0",
            ddsource: "nodejs",
        },
        transports: [
            new winston.transports.Console({
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
