import { LoggerService } from "@nestjs/common"
import * as winston from "winston"
import { createWinstonLogger } from "./winston-logger"

export class WinstonLoggerService implements LoggerService {
    private readonly logger: winston.Logger
    private context?: string

    constructor(serviceName: string) {
        this.logger = createWinstonLogger(serviceName)
    }

    setContext(context: string) {
        this.context = context
    }

    log(message: any, ...optionalParams: any[]) {
        const context = optionalParams[0] || this.context
        this.logger.info(message, { context })
    }

    error(message: any, ...optionalParams: any[]) {
        const [trace, context] = optionalParams
        this.logger.error(message, {
            context: context || this.context,
            stack: trace,
        })
    }

    warn(message: any, ...optionalParams: any[]) {
        const context = optionalParams[0] || this.context
        this.logger.warn(message, { context })
    }

    debug(message: any, ...optionalParams: any[]) {
        const context = optionalParams[0] || this.context
        this.logger.debug(message, { context })
    }

    verbose(message: any, ...optionalParams: any[]) {
        const context = optionalParams[0] || this.context
        this.logger.verbose(message, { context })
    }

    fatal(message: any, ...optionalParams: any[]) {
        const context = optionalParams[0] || this.context
        this.logger.error(message, { context, level: "fatal" })
    }
}
