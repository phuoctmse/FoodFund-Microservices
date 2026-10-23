import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { DatadogInterceptor, initDatadogTracer, WinstonLoggerService } from "@libs/observability"
import { join } from "node:path"

initDatadogTracer({
    serviceName: "operation-service",
    serviceType: "backend",
    microservice: "operation",
})

async function bootstrap() {
    const logger = new WinstonLoggerService("operation-service")
    const app = await NestFactory.create(AppModule, {
        logger,
    })
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

    const env = envConfig()
    const grpcPort = env.grpc.operation?.port || 50004
    const grpcUrl = env.grpc.operation?.url || "localhost:50004"
    const port = env.containers["operation-subgraph"]?.port ?? 8005

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: "foodfund.operation",
            protoPath: join(
                __dirname,
                "../../../libs/grpc/proto/operation.proto",
            ),
            url: `0.0.0.0:${grpcPort}`,
        },
    })

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 Operation Service is running on port: ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
}
bootstrap()
