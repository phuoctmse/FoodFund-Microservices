import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { SentryService } from "@libs/observability/sentry.service"
import { GraphQLExceptionFilter } from "@libs/exceptions"
import { envConfig } from "@libs/env"
import { DatadogInterceptor, initDatadogTracer, WinstonLoggerService } from "@libs/observability"
import { join } from "node:path"

initDatadogTracer({
    serviceName: "campaign-service",
    serviceType: "backend",
    microservice: "campaign",
})

async function bootstrap() {
    const logger = new WinstonLoggerService("campaign-service")
    const app = await NestFactory.create(AppModule, {
        logger,
        bufferLogs: true,
    })
    const env = envConfig()
    const sentryService = app.get(SentryService)
    const datadogInterceptor = app.get(DatadogInterceptor)

    app.useGlobalPipes(new CustomValidationPipe())
    if (process.env.NODE_ENV === "production") {
        app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))
    }
    app.useGlobalInterceptors(datadogInterceptor)
    const grpcPort = env.grpc.campaign?.port || 50003
    const grpcUrl = env.grpc.campaign?.url || "localhost:50003"
    const port = env.containers["campaigns-subgraph"]?.port || 8004

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: "foodfund.campaign",
            protoPath: join(__dirname, "../../../libs/grpc/proto/campaign.proto"),
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
                groupId: "campaign-service-consumer-v2",
            },
        },
    })

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 Campaign Service is running on port: ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
}
bootstrap()
