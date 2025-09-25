import { Injectable, Inject, Logger } from "@nestjs/common"
import * as Sentry from "@sentry/nestjs"

@Injectable()
export class SentryService {
    private readonly logger = new Logger(SentryService.name)

    constructor(
        @Inject("SENTRY_OPTIONS")
        private readonly options: { serviceName: string },
    ) {}

    // Capture error with context
    captureError(error: Error, context?: Record<string, any>) {
        Sentry.withScope((scope) => {
            scope.setTag("service", this.options.serviceName)

            if (context) {
                Object.keys(context).forEach((key) => {
                    scope.setContext(key, context[key])
                })
            }

            Sentry.captureException(error)
        })
    }

    // Capture message/log
    captureMessage(
        message: string,
        level: "info" | "warning" | "error" = "info",
        context?: Record<string, any>,
    ) {
        Sentry.withScope((scope) => {
            scope.setTag("service", this.options.serviceName)
            scope.setLevel(level)

            if (context) {
                Object.keys(context).forEach((key) => {
                    scope.setContext(key, context[key])
                })
            }

            Sentry.captureMessage(message)
        })
    }

    // Add breadcrumb (for tracing user actions)
    addBreadcrumb(
        message: string,
        category?: string,
        data?: Record<string, any>,
    ) {
        Sentry.addBreadcrumb({
            message,
            category: category || "custom",
            data,
            timestamp: Date.now() / 1000,
        })
    }

    // Set user context
    setUser(user: { id: string; email?: string; username?: string }) {
        Sentry.setUser(user)
    }

    // Capture performance (simplified)
    async capturePerformance<T>(
        name: string,
        operation: string,
        fn: () => Promise<T>,
    ): Promise<T> {
        const startTime = Date.now()

        try {
            const result = await fn()
            const duration = Date.now() - startTime

            // Log performance as message if slow
            if (duration > 1000) {
                this.captureMessage(
                    `Slow operation: ${name} took ${duration}ms`,
                    "warning",
                    {
                        operation,
                        duration,
                        service: this.options.serviceName,
                    },
                )
            }

            return result
        } catch (error) {
            const duration = Date.now() - startTime
            this.captureError(error as Error, {
                operation: name,
                duration,
                service: this.options.serviceName,
            })
            throw error
        }
    }
}
