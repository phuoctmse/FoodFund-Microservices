import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { envConfig } from "@libs/env"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
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
    const port = envConfig().containers["operation-subgraph"]?.port ?? 8005
    await app.listen(port)
    console.log(`🚀 Operation Service is running on: ${port}`)
}
bootstrap()
