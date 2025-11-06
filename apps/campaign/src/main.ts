import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { ValidationPipe } from "@nestjs/common"
import { SentryService } from "@libs/observability/sentry.service"
import { GraphQLExceptionFilter } from "@libs/exceptions"
import { GrpcServerService } from "@libs/grpc"
import { CampaignGrpcService } from "./campaign/grpc"
import { envConfig } from "@libs/env"

async function bootstrap() {
    try {
        const app = await NestFactory.create(AppModule, {
            bufferLogs: true,
        })

        const sentryService = app.get(SentryService)
        const grpcServer = app.get(GrpcServerService)
        const campaignGrpcService = app.get(CampaignGrpcService)

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
        app.useGlobalFilters(new GraphQLExceptionFilter(sentryService))

        app.use((req, res, next) => {
            res.header("X-Content-Type-Options", "nosniff")
            res.header("X-Frame-Options", "deny")
            res.header("Content-Security-Policy", "default-src 'none'")
            res.header("X-XSS-Protection", "1; mode=block")
            res.removeHeader("X-Powered-By")
            next()
        })

        // Initialize and start gRPC server
        await grpcServer.initialize({
            serviceName: "CampaignService",
            protoPath: "campaign.proto",
            packageName: "foodfund.campaign",
            port: envConfig().grpc.campaign?.port || 50003,
            implementation: campaignGrpcService.getImplementation(),
        })

        const port = process.env.CAMPAIGNS_SUBGRAPH_PORT ?? 8004

        // Start both HTTP and gRPC servers
        await Promise.all([app.listen(port), grpcServer.start()])

        console.log(`🚀 Campaign Service HTTP running on port: ${port}`)
        console.log(
            `🔗 Campaign Service gRPC running on port: ${envConfig().grpc.campaign?.port || 50003}`,
        )
    } catch (error) {
        console.error("❌ Failed to start Campaign Service:", error)
        process.exit(1)
    }
}

bootstrap().catch((error) => {
    console.error("Bootstrap failed:", error)
    process.exit(1)
})
