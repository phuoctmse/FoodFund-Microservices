import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { GraphQLExceptionFilter } from "@libs/exceptions"

async function bootstrap() {
    try {
        const app = await NestFactory.create(AppModule, {
            logger:
                process.env.NODE_ENV === "development"
                    ? ["error", "warn", "log", "debug", "verbose"]
                    : ["error", "warn", "log"],
        })

        const sentryService = app.get(SentryService)

        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                    exposeDefaultValues: true,
                },
                whitelist: true,
                forbidNonWhitelisted: true,
                validateCustomDecorators: true,
                disableErrorMessages: process.env.NODE_ENV === "production",
                stopAtFirstError: false,
                forbidUnknownValues: true,
            }),
        )
        app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

        app.use((req, res, next) => {
            res.header("X-Content-Type-Options", "nosniff")
            res.header("X-Frame-Options", "deny")
            res.header("Content-Security-Policy", "default-src 'none'")
            res.header("X-XSS-Protection", "1; mode=block")
            res.removeHeader("X-Powered-By")
            next()
        })

        app.enableCors({
            origin:
                process.env.NODE_ENV === "production"
                    ? ["http://localhost:8000"].filter(Boolean)
                    : true,
            credentials: true,
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "Accept",
                "X-Requested-With",
                "Apollo-Require-Preflight",
            ],
        })

        const port = process.env.PORT ?? 8004
        await app.listen(port)

        const isDevelopment = process.env.NODE_ENV === "development"

        sentryService.captureMessage(
            "Campaign service started successfully",
            "info",
            {
                port,
                environment: process.env.NODE_ENV,
                federation: "enabled",
                validation: "enhanced",
                development: isDevelopment,
            },
        )
    } catch (error) {
        process.exit(1)
    }
}

bootstrap().catch((error) => {
    console.error("Failed to start campaign service:", error)
    process.exit(1)
})
