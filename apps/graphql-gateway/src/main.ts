import { NestFactory } from "@nestjs/core"
import { ApiGatewayModule } from "./app.module"
import * as compression from "compression"

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule)

    // CORS origins can be configured via environment variable CORS_ORIGIN
    // Example: "https://api.minhphuoc.io.vn,https://food-fund.vercel.app"
    const envOrigins = process.env.CORS_ORIGIN || "http://localhost:3000,https://food-fund.vercel.app"
    const allowedOrigins = envOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

    app.use(compression())
    app.enableCors({
        origin: (origin, callback) => {
            // allow non-browser requests (curl, server-to-server)
            if (!origin) return callback(null, true)

            // if wildcard present, allow all
            if (allowedOrigins.includes("*")) return callback(null, true)

            if (allowedOrigins.includes(origin)) return callback(null, true)

            return callback(new Error(`CORS policy: This origin is not allowed: ${origin}`), false)
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Accept", "Accept-Encoding"],
    })

    const port = process.env.PORT ?? 8000
    await app.listen(port)

    // Determine the correct URL based on environment
    const nodeEnv = process.env.NODE_ENV || "development"
    const apiDomain = process.env.API_DOMAIN || ""

    // Prefer API_DOMAIN in production, otherwise show local address
    const serverUrl = nodeEnv === "production" && apiDomain ? `${apiDomain}/graphql` : `http://localhost:${port}/graphql`

    console.log(`🚀 GraphQL Gateway is running on: ${serverUrl}`)
}
bootstrap()
