import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    const sentryService = app.get(SentryService)
    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))
    await app.listen(process.env.PORT ?? 8002)
}
bootstrap()
