import { NestFactory } from "@nestjs/core"
import { ApiGatewayModule } from "./app.module"
import * as compression from "compression"

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule)

    const allowedOrigins = [
        "http://localhost:3000", // FE local dev
        "https://food-fund.vercel.app", // FE production trên Vercel
        "https://seahorse-app-i62zf.ondigitalocean.app",
        "http://localhost:8000", // GraphQL Gateway local
        "http://localhost:8001", // Auth service local
        "http://localhost:8002", // User service local
    ]
    app.use(compression())
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true)
            if (allowedOrigins.includes(origin)) {
                return callback(null, true)
            }
            return callback(
                new Error(`CORS policy: This origin is not allowed: ${origin}`),
                false,
            )
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })

    const port = process.env.PORT ?? 8000
    await app.listen(port)

    console.log(
        `🚀 GraphQL Gateway is running on: http://localhost:${port}/graphql`,
    )
}
bootstrap()
