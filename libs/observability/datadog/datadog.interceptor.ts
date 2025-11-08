import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import { Observable } from "rxjs"
import { tap, catchError } from "rxjs/operators"
import { DatadogService } from "./datadog.service"

/**
 * Datadog HTTP Interceptor
 * 
 * Automatically tracks HTTP and GraphQL requests
 * Replaces PrometheusInterceptor functionality
 * 
 * Features:
 * - HTTP request metrics (count, duration, errors)
 * - GraphQL operation metrics
 * - Automatic error tracking
 * - Request/response correlation
 */
@Injectable()
export class DatadogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(DatadogInterceptor.name)

    constructor(private readonly datadogService: DatadogService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const contextType = context.getType<string>()
        const startTime = Date.now()

        // Handle GraphQL requests
        if (contextType === "graphql") {
            return this.handleGraphQLRequest(context, next, startTime)
        }

        // Handle HTTP requests
        return this.handleHttpRequest(context, next, startTime)
    }

    private handleHttpRequest(
        context: ExecutionContext,
        next: CallHandler,
        startTime: number,
    ): Observable<any> {
        const request = context.switchToHttp().getRequest()
        const response = context.switchToHttp().getResponse()

        // Skip if request or response is undefined
        if (!request || !response) {
            return next.handle()
        }

        // Skip health checks and metrics endpoints
        if (this.shouldSkipPath(request.path)) {
            return next.handle()
        }

        const method = request.method || "UNKNOWN"
        const path = this.normalizePathForMetrics(
            request.route?.path || request.path || "/unknown",
        )

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime
                const statusCode = response.statusCode || 200

                // Record HTTP metrics
                this.datadogService.recordHttpRequest(method, path, statusCode, duration)

                // Log slow requests
                if (duration > 1000) {
                    this.logger.warn(
                        `Slow HTTP request: ${method} ${path} took ${duration}ms`,
                        {
                            method,
                            path,
                            duration,
                            statusCode,
                        },
                    )
                }
            }),
            catchError((error) => {
                const duration = Date.now() - startTime
                const statusCode = error.status || 500

                // Record error metrics
                this.datadogService.recordHttpRequest(method, path, statusCode, duration)

                // Log error
                this.logger.error(
                    `HTTP request error: ${method} ${path}`,
                    {
                        method,
                        path,
                        duration,
                        statusCode,
                        error: error.message,
                    },
                )

                throw error
            }),
        )
    }

    private handleGraphQLRequest(
        context: ExecutionContext,
        next: CallHandler,
        startTime: number,
    ): Observable<any> {
        const gqlContext = GqlExecutionContext.create(context)
        const info = gqlContext.getInfo()
    
        const operationName = info?.operation?.name?.value || "anonymous"
        const operationType = info?.operation?.operation || "query"

        return next.handle().pipe(
            tap((result) => {
                const duration = Date.now() - startTime
                const hasErrors = result?.errors && result.errors.length > 0

                // Record GraphQL metrics
                this.datadogService.recordGraphqlOperation(
                    operationName,
                    operationType,
                    duration,
                    hasErrors,
                )

                // Log slow operations
                if (duration > 1000) {
                    this.logger.warn(
                        `Slow GraphQL operation: ${operationType} ${operationName} took ${duration}ms`,
                        {
                            operationName,
                            operationType,
                            duration,
                            hasErrors,
                        },
                    )
                }
            }),
            catchError((error) => {
                const duration = Date.now() - startTime

                // Record GraphQL error metrics
                this.datadogService.recordGraphqlOperation(
                    operationName,
                    operationType,
                    duration,
                    true,
                )

                // Log GraphQL error
                this.logger.error(
                    `GraphQL operation error: ${operationType} ${operationName}`,
                    {
                        operationName,
                        operationType,
                        duration,
                        error: error.message,
                    },
                )

                throw error
            }),
        )
    }

    /**
   * Normalize path for consistent metrics
   * Replace dynamic segments with placeholders
   */
    private normalizePathForMetrics(path: string): string {
        return path
            .replace(/\/\d+/g, "/:id") // Replace numeric IDs
            .replace(/\/[a-f0-9-]{36}/g, "/:uuid") // Replace UUIDs
            .replace(/\/[a-f0-9]{24}/g, "/:objectId") // Replace MongoDB ObjectIds
            .replace(/\?.*$/, "") // Remove query parameters
    }

    /**
   * Skip certain paths from metrics collection
   */
    private shouldSkipPath(path: string): boolean {
        const skipPaths = [
            "/health",
            "/metrics",
            "/favicon.ico",
            "/_next",
            "/static",
        ]

        return skipPaths.some((skipPath) => path.startsWith(skipPath))
    }
}
