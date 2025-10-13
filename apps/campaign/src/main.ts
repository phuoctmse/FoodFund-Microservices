import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { SentryService } from "@libs/observability/sentry.service"
import { GrpcServerService } from "libs/grpc"
import { CustomValidationPipe } from "@libs/validation"
import { GraphQLExceptionFilter } from "@libs/exceptions"

async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    // Get services for setup
    const sentryService = app.get(SentryService)
    // const grpcServer = app.get(GrpcServerService)
    // const campaignGrpcService = app.get(CampaignGrpcService)

    // Enable validation with class-validator using custom pipe
    app.useGlobalPipes(new CustomValidationPipe())

    // Enable GraphQL exception filter (better for GraphQL APIs)
    app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

    try {
        // // Initialize and start gRPC server with UserGrpcService implementation
        // await grpcServer.initialize({
        //     serviceName: "UserService",
        //     protoPath: "user.proto",
        //     packageName: "foodfund.user",
        //     port: parseInt(process.env.USERS_GRPC_PORT || "50002"),
        //     implementation: userGrpcService.getImplementation(),
        // })

        // Start both HTTP and gRPC servers
        await Promise.all([
            app.listen(process.env.CAMPAIGNS_SUBGRAPH_PORT ?? 8003),
            // grpcServer.start(),
        ])
    } catch (error) {
        console.error("Failed to start User service:", error)
        process.exit(1)
    }

    console.log(
        `🚀 User Service HTTP running on: http://${process.env.CAMPAIGNS_SUBGRAPH_HOST}:${process.env.CAMPAIGNS_SUBGRAPH_PORT}`,
    )
    console.log(
        `🔗 User Service gRPC running on: ${process.env.CAMPAIGNS_SUBGRAPH_HOST}:${process.env.CAMPAIGN_GRPC_PORT}`,
    )
}
bootstrap()