import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { DatadogInterceptor } from "@libs/observability"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    const datadogInterceptor = app.get(DatadogInterceptor)

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
                exposeDefaultValues: true,
            },
            whitelist: true,
            forbidNonWhitelisted: false,
            validateCustomDecorators: true,
            disableErrorMessages: process.env.NODE_ENV === "production",
            stopAtFirstError: false,
            forbidUnknownValues: false,
        }),
    )
    app.useGlobalInterceptors(datadogInterceptor)

    const port = envConfig().containers["operation-subgraph"]?.port ?? 8005
    await app.listen(port)
    console.log(`🚀 Operation Service is running on: ${port}`)
    console.log(`📊 Prometheus metrics available at http://localhost:${port}/metrics`)
}
bootstrap()
