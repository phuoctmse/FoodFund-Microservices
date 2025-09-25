import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from "@nestjs/common"
import { Observable, throwError } from "rxjs"
import { catchError, tap } from "rxjs/operators"
import { SentryService } from "./sentry.service"
import { GqlExecutionContext } from "@nestjs/graphql"

@Injectable()
export class SentryInterceptor implements NestInterceptor {
    private readonly logger = new Logger(SentryInterceptor.name)

    constructor(private readonly sentryService: SentryService) {}

    intercept(
        context: GqlExecutionContext,
        next: CallHandler,
    ): Observable<any> {
        const ctx = GqlExecutionContext.create(context)
        const request = ctx.getContext().req
        const response = context.switchToHttp().getResponse()

        const { method, url, body, query, params, headers } = request
        const startTime = Date.now()

        // Add breadcrumb for request
        this.sentryService.addBreadcrumb(`${method} ${url}`, "http", {
            method,
            url,
            query,
            params,
            userAgent: headers["user-agent"],
        })

        return next.handle().pipe(
            tap(() => {
                // Log successful requests
                const duration = Date.now() - startTime

                if (duration > 1000) {
                    // Log slow requests
                    this.sentryService.captureMessage(
                        `Slow request: ${method} ${url} took ${duration}ms`,
                        "warning",
                        {
                            method,
                            url,
                            duration,
                            statusCode: response.statusCode,
                        },
                    )
                }
            }),
            catchError((error) => {
                // Capture errors with request context
                this.sentryService.captureError(error, {
                    request: {
                        method,
                        url,
                        body: this.sanitizeBody(body),
                        query,
                        params,
                        headers: this.sanitizeHeaders(headers),
                    },
                    response: {
                        statusCode: response.statusCode,
                    },
                    duration: Date.now() - startTime,
                })

                return throwError(() => error)
            }),
        )
    }

    private sanitizeBody(body: any): any {
        if (!body) return body

        // Remove sensitive fields
        const sensitiveFields = ["password", "token", "secret", "key"]
        const sanitized = { ...body }

        sensitiveFields.forEach((field) => {
            if (sanitized[field]) {
                sanitized[field] = "[REDACTED]"
            }
        })

        return sanitized
    }

    private sanitizeHeaders(headers: any): any {
        const sanitized = { ...headers }
        const sensitiveHeaders = ["authorization", "cookie", "x-api-key"]

        sensitiveHeaders.forEach((header) => {
            if (sanitized[header]) {
                sanitized[header] = "[REDACTED]"
            }
        })

        return sanitized
    }
}
