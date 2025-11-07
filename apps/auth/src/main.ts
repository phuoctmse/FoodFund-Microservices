import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import { envConfig } from "libs/env"
import { join } from "path"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    const sentryService = app.get(SentryService)
    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

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
}
bootstrap()
