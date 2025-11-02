import { NestFactory } from "@nestjs/core"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import { envConfig } from "libs/env"
import { join } from "path"

async function bootstrap() {
    // Create HTTP/GraphQL application
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    })

    const sentryService = app.get(SentryService)
    app.useGlobalPipes(new CustomValidationPipe())
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

    // Connect gRPC microservice
    const grpcPort = envConfig().grpc.auth?.port || 50001
    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.GRPC,
        options: {
            package: "foodfund.auth",
            protoPath: join(__dirname, "../../../libs/grpc/proto/auth.proto"),
            url: `0.0.0.0:${grpcPort}`,
        },
    })

    const port = process.env.PORT ?? 8002
    const host = "localhost"

    try {
        // Start all microservices
        await app.startAllMicroservices()

        // Start HTTP server
        await app.listen(port)

        console.log("=".repeat(60))
        console.log("🚀 Auth Service Started Successfully")
        console.log("=".repeat(60))
        console.log(`📍 HTTP/GraphQL: http://${host}:${port}`)
        console.log(`🏥 Health Check: http://${host}:${port}/health`)
        console.log(`🎮 GraphQL Playground: http://${host}:${port}/graphql`)
        console.log(`🔌 gRPC Server: 0.0.0.0:${grpcPort}`)
        console.log(`📊 Environment: ${envConfig().nodeEnv}`)
        console.log("=".repeat(60))
    } catch (error) {
        console.error("❌ Failed to start Auth service:", error)
        process.exit(1)
    }
}

bootstrap()
