import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    // Get SentryService for exception filter
    const sentryService = app.get(SentryService)

    // Enable validation with class-validator using custom pipe
    app.useGlobalPipes(new CustomValidationPipe())

    // Enable GraphQL exception filter (better for GraphQL APIs)
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

    await app.listen(process.env.PORT ?? 8002)
}
bootstrap()
