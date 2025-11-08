import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import {
    DatadogInterceptor,
    initDatadogTracer,
} from "@libs/observability/datadog"
import { envConfig } from "@libs/env"
import { join } from "path"

initDatadogTracer({
    serviceName: "user-service",
    serviceType: "backend",
    microservice: "user",
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

    // Enable Prometheus metrics interceptor
    app.useGlobalInterceptors(datadogInterceptor)

    // Setup gRPC microservice
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

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 User Service is running on port ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
}
bootstrap()
