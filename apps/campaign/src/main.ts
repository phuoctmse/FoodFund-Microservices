import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { SentryService } from "@libs/observability/sentry.service"
import { GraphQLExceptionFilter } from "@libs/exceptions"
import { envConfig } from "@libs/env"
import { DatadogInterceptor, initDatadogTracer } from "@libs/observability"
import { join } from "path"

initDatadogTracer({
    serviceName: "campaign-service",
    serviceType: "backend",
    microservice: "campaign",
})

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    })

    // Get services for setup
    const sentryService = app.get(SentryService)
    const datadogInterceptor = app.get(DatadogInterceptor)

    // Enable validation with class-validator using custom pipe
    app.useGlobalPipes(new CustomValidationPipe())

    // Enable GraphQL exception filter (better for GraphQL APIs)
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

    // Enable Datadog interceptor
    app.useGlobalInterceptors(datadogInterceptor)

    // Setup gRPC microservice
    const env = envConfig()
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

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 Campaign Service is running on port ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
}
bootstrap()
