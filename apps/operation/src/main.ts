import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { PrometheusInterceptor } from "@libs/observability/prometheus"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    const prometheusInterceptor = app.get(PrometheusInterceptor)

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
    app.useGlobalInterceptors(prometheusInterceptor)

    const port = envConfig().containers["operation-subgraph"]?.port ?? 8005
    await app.listen(port)
    console.log(`🚀 Operation Service is running on: ${port}`)
    console.log(`📊 Prometheus metrics available at http://localhost:${port}/metrics`)
}
bootstrap()
