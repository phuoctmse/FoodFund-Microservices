import { Module, DynamicModule, Global } from "@nestjs/common"
import { APP_INTERCEPTOR } from "@nestjs/core"
import * as Sentry from "@sentry/nestjs"
import { SentryInterceptor } from "./sentry.interceptor"
import { SentryService } from "./sentry.service"

export interface SentryModuleOptions {
    dsn: string
    serviceName: string
    environment?: string
    release?: string
    enableTracing?: boolean
}

@Global()
@Module({})
export class SentryModule {
    static forRoot(options: SentryModuleOptions): DynamicModule {
        // Initialize Sentry
        Sentry.init({
            dsn: options.dsn,
            environment: options.environment || "development",
            release: options.release || "1.0.0",
            serverName: options.serviceName,
            tracesSampleRate: options.enableTracing ? 1.0 : 0,
            integrations: [
                Sentry.httpIntegration(),
                Sentry.expressIntegration(),
            ],
            beforeSend(event) {
                // Add service name to all events
                event.tags = {
                    ...event.tags,
                    service: options.serviceName,
                }
                return event
            },
        })

        return {
            module: SentryModule,
            controllers: [],
            providers: [
                {
                    provide: "SENTRY_OPTIONS",
                    useValue: options,
                },
                SentryService,
                {
                    provide: APP_INTERCEPTOR,
                    useClass: SentryInterceptor,
                },
            ],
            exports: [SentryService],
        }
    }
}
