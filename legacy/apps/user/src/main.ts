import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import {
    DatadogInterceptor,
    initDatadogTracer,
    WinstonLoggerService,
} from "@libs/observability"
import { envConfig } from "@libs/env"
import { join } from "node:path"

initDatadogTracer({
    serviceName: "user-service",
    serviceType: "backend",
    microservice: "user",
})

async function bootstrap() {
    const logger = new WinstonLoggerService("user-service")
    const app = await NestFactory.create(AppModule, {
        logger,
        bufferLogs: true,
    })

    const sentryService = app.get(SentryService)
    const datadogInterceptor = app.get(DatadogInterceptor)

    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))
    app.useGlobalInterceptors(datadogInterceptor)

    const env = envConfig()
    const grpcPort = env.grpc.user?.port || 50002
    const grpcUrl = env.grpc.user?.url || "localhost:50002"
    const port = env.containers["users-subgraph"]?.port || 8003

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: "foodfund.user",
            protoPath: join(__dirname, "../../../libs/grpc/proto/user.proto"),
            url: `0.0.0.0:${grpcPort}`,
        },
    })

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
            client: {
                brokers: [env.kafkaUrl],
            },
            consumer: {
                groupId: "user-service-consumer-v2",
            },
        },
    })

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 User Service is running on port: ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
}
bootstrap()
