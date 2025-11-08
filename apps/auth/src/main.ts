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
import { envConfig } from "libs/env"
import { join } from "path"

initDatadogTracer({
    serviceName: "auth-service",
    serviceType: "backend",
    microservice: "auth",
})

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    const sentryService = app.get(SentryService)
    const datadogInterceptor = app.get(DatadogInterceptor)

    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))
    app.useGlobalInterceptors(datadogInterceptor)

    // Setup gRPC microservice
    const env = envConfig()
    const grpcPort = env.grpc.auth?.port || 50001
    const grpcUrl = env.grpc.auth?.url || "localhost:50001"
    const port = env.containers.auth?.port || 8002

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: "foodfund.auth",
            protoPath: join(__dirname, "../../../libs/grpc/proto/auth.proto"),
            url: `0.0.0.0:${grpcPort}`,
        },
    })

    await app.startAllMicroservices()
    await app.listen(port)

    console.log(`🚀 Auth Service is running on port ${port}`)
    console.log(`🔌 gRPC server is listening on 0.0.0.0:${grpcPort}`)
    console.log(`🔗 gRPC clients should connect to: ${grpcUrl}`)
    console.log(
        "📊 Datadog APM traces available at https://us5.datadoghq.com/apm/services",
    )
    console.log(
        "📈 Datadog metrics available at https://us5.datadoghq.com/infrastructure",
    )
}
bootstrap()
