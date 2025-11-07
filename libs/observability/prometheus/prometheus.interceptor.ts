import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from "@nestjs/common"
import { GqlExecutionContext } from "@nestjs/graphql"
import { Observable } from "rxjs"
import { tap } from "rxjs/operators"
import { PrometheusService } from "./prometheus.service"

/**
 * Prometheus HTTP Interceptor
 *
 * Automatically tracks HTTP request metrics:
 * - Total requests
 * - Request duration
 * - Error rates
 * - Status codes
 *
 * Apply globally or per-controller
 */
@Injectable()
export class PrometheusInterceptor implements NestInterceptor {
    private readonly logger = new Logger(PrometheusInterceptor.name)

    constructor(private readonly prometheusService: PrometheusService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Check if this is a GraphQL context
        const contextType = context.getType<string>()
        
        if (contextType === "graphql") {
            // For GraphQL, we can optionally track metrics differently
            // For now, skip GraphQL requests to avoid errors
            return next.handle()
        }

        const request = context.switchToHttp().getRequest()
        const response = context.switchToHttp().getResponse()

        // Skip if request or response is undefined (edge cases)
        if (!request || !response) {
            return next.handle()
        }

        // Skip metrics endpoint itself
        if (request.path === "/metrics") {
            return next.handle()
        }

        const startTime = Date.now()
        const method = request.method || "UNKNOWN"
        const path = this.normalizePathForMetrics(request.route?.path || request.path || "/unknown")
        const service = process.env.SERVICE_NAME || "unknown"

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = (Date.now() - startTime) / 1000 // Convert to seconds
                    const statusCode = response.statusCode || 200

                    this.prometheusService.recordHttpRequest(
                        method,
                        path,
                        statusCode,
                        duration,
                        service,
                    )
                },
                error: (error) => {
                    const duration = (Date.now() - startTime) / 1000
                    const statusCode = error.status || 500

                    this.prometheusService.recordHttpRequest(
                        method,
                        path,
                        statusCode,
                        duration,
                        service,
                    )
                },
            }),
        )
    }

    /**
     * Normalize path to avoid high cardinality in metrics
     * Converts /users/123 -> /users/:id
     */
    private normalizePathForMetrics(path: string): string {
        // Remove query parameters
        const cleanPath = path.split("?")[0]

        // Replace UUIDs and numeric IDs with placeholders
        return cleanPath
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
            .replace(/\/\d+/g, "/:id")
    }
}
