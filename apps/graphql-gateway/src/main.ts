import { NestFactory } from "@nestjs/core"
import { ApiGatewayModule } from "./app.module"

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule)

    const port = process.env.PORT ?? 8000
    await app.listen(port)

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

    console.log(
        `🚀 GraphQL Gateway is running on: http://localhost:${port}/graphql`,
    )
}
bootstrap()
