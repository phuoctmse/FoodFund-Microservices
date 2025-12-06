import { Module, DynamicModule, Global } from "@nestjs/common"
import { DatadogService } from "./datadog.service"
import { DatadogInterceptor } from "./datadog.interceptor"

export interface DatadogModuleOptions {
    serviceName: string
    env?: string
    version?: string
}

/**
 * Datadog Observability Module
 *
 * Replaces Prometheus module with Datadog APM, Metrics, and Logging
 *
 * Features:
 * - Automatic APM tracing for HTTP requests
 * - Custom metrics via DogStatsD
 * - Structured logging
 * - GraphQL tracing support
 * - Database query tracing
 */
@Global()
@Module({})
export class DatadogModule {
    static forRoot(options: DatadogModuleOptions): DynamicModule {
        return {
            module: DatadogModule,
            providers: [
                {
                    provide: "DATADOG_OPTIONS",
                    useValue: {
                        serviceName: options.serviceName,
                        env:
                            options.env ||
                            process.env.NODE_ENV ||
                            "development",
                        version:
                            options.version ||
                            process.env.SERVICE_VERSION ||
                            "1.0.0",
                    },
                },
                DatadogService,
                DatadogInterceptor,
            ],
            exports: [DatadogService, DatadogInterceptor],
        }
    }
}
