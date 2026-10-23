import * as winston from "winston"
import { envConfig, isProduction } from "@libs/env"

const { combine, timestamp, json, errors, printf, colorize } = winston.format


const devFormat = printf(({ level, message, context, timestamp }) => {
    const ctx = context ? `[${context}]` : ""
    return `${timestamp} ${level} ${ctx} ${message}`
})


export function createWinstonLogger(serviceName: string): winston.Logger {
    const env = envConfig()
    const isProd = isProduction()

    const logFormat = isProd
        ? combine(
            errors({ stack: true }),
            timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
            json(),
        )
        : combine(
            colorize({ all: true }),
            timestamp({ format: "HH:mm:ss" }),
            devFormat,
        )

    return winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: logFormat,
        defaultMeta: isProd
            ? {
                service: serviceName,
                env: env.datadog.env || env.nodeEnv || "development",
                version: env.datadog.version || "1.0.0",
                ddsource: "nodejs",
            }
            : { service: serviceName },
        transports: [new winston.transports.Console()],
    })
}
