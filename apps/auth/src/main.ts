import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import { CloudWatchLoggerService } from "@libs/aws-cloudwatch"

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    })

    // Use CloudWatch logger in production
    if (process.env.NODE_ENV === "production") {
        app.useLogger(app.get(CloudWatchLoggerService))
    }
    const sentryService = app.get(SentryService)
    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))
    await app.listen(process.env.PORT ?? 8002)
}
bootstrap()
