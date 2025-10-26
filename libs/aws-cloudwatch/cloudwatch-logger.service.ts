import { Injectable, LoggerService } from "@nestjs/common"
import * as winston from "winston"
import * as WinstonCloudWatch from "winston-cloudwatch"
import { envConfig, isProduction } from "@libs/env"
import { randomUUID } from "node:crypto"

@Injectable()
export class CloudWatchLoggerService implements LoggerService {
    private logger: winston.Logger

    constructor() {
        const config = envConfig()
        const transports: winston.transport[] = [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                ),
            }),
        ]

        // Only add CloudWatch in production
        if (
            isProduction() &&
            config.aws.region &&
            config.aws.cloudwatch.logGroup
        ) {
            const logGroup = config.aws.cloudwatch.logGroup
            const uniqueId = process.env.HOSTNAME || randomUUID()
            const date = new Date().toISOString().split("T")[0]
            const logStream = `app-${date}-${uniqueId}-${process.pid}`

            transports.push(
                new WinstonCloudWatch({
                    logGroupName: logGroup,
                    logStreamName: logStream,
                    awsRegion: config.aws.region,
                    jsonMessage: true,
                    retentionInDays: 7,
                }),
            )
        }

        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
            ),
            transports,
        })
    }

    log(message: string, context?: string) {
        this.logger.info(message, { context })
    }

    error(message: string, trace?: string, context?: string) {
        this.logger.error(message, { trace, context })
    }

    warn(message: string, context?: string) {
        this.logger.warn(message, { context })
    }

    debug(message: string, context?: string) {
        this.logger.debug(message, { context })
    }

    verbose(message: string, context?: string) {
        this.logger.verbose(message, { context })
    }
}
