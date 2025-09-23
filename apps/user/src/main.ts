import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { CustomValidationPipe } from "libs/validation"
import { GraphQLExceptionFilter } from "libs/exceptions"
import { SentryService } from "libs/observability/sentry.service"
import { GrpcServerService } from "libs/grpc"
import { UserGrpcService } from "./user/grpc/user-grpc.service"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    // Get services for setup
    const sentryService = app.get(SentryService)
    const grpcServer = app.get(GrpcServerService)
    const userGrpcService = app.get(UserGrpcService)

    // Enable validation with class-validator using custom pipe
    app.useGlobalPipes(new CustomValidationPipe())

    // Enable GraphQL exception filter (better for GraphQL APIs)
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

    app.enableCors({
        // origin: [
        //     "http://localhost:3000", // Thay bằng domain FE của bạn
        //     "https://your-frontend-domain.com"
        // ],
        origin: "*",
        credentials: true, // Cho phép gửi cookie, token
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })

    try {
        // Initialize and start gRPC server with UserGrpcService implementation
        await grpcServer.initialize({
            serviceName: "UserService",
            protoPath: "user.proto",
            packageName: "foodfund.user",
            port: parseInt(process.env.USERS_GRPC_PORT || "50002"),
            implementation: userGrpcService.getImplementation(),
        })

        // Start both HTTP and gRPC servers
        await Promise.all([
            app.listen(process.env.PORT ?? 8003),
            grpcServer.start(),
        ])
    } catch (error) {
        console.error("Failed to start User service:", error)
        process.exit(1)
    }

    console.log(
        `🚀 User Service HTTP running on: http://localhost:${process.env.PORT ?? 8003}`,
    )
    console.log(
        `🔗 User Service gRPC running on: localhost:${process.env.USERS_GRPC_PORT ?? 50002}`,
    )
}
bootstrap()
