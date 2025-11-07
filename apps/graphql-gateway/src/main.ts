import { NestFactory } from "@nestjs/core"
import { ApiGatewayModule } from "./app.module"
import * as compression from "compression"
import { envConfig } from "@libs/env"
import { DatadogInterceptor } from "@libs/observability"

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule, {
        bufferLogs: true,
    })

    const datadogInterceptor = app.get(DatadogInterceptor)
    app.useGlobalInterceptors(datadogInterceptor)

    const envOrigins = envConfig().cors_origin

    // Convert comma-separated string to array and trim whitespace
    const allowedOrigins = envOrigins
        ? envOrigins.split(",").map((origin) => origin.trim())
        : ["http://localhost:3000"]

    app.use(compression())
    app.enableCors({
        origin: (origin, callback) => {
            // allow non-browser requests (curl, server-to-server)
            if (!origin) return callback(null, true)

            // if wildcard present, allow all
            if (allowedOrigins.includes("*")) return callback(null, true)

            if (allowedOrigins.includes(origin)) return callback(null, true)

            return callback(
                new Error(`CORS policy: This origin is not allowed: ${origin}`),
                false,
            )
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Accept",
            "Accept-Encoding",
        ],
    })

    const port = process.env.PORT ?? 8000
    await app.listen(port)

    // Determine the correct URL based on environment
    const nodeEnv = process.env.NODE_ENV || "development"
    const apiDomain = process.env.API_DOMAIN || ""

    // Debug logging
    console.log(`Environment: NODE_ENV=${nodeEnv}, API_DOMAIN=${apiDomain}`)

    // Prefer API_DOMAIN in production, otherwise show local address
    const serverUrl =
        nodeEnv === "production" && apiDomain
            ? `${apiDomain}/graphql`
            : `http://localhost:${port}/graphql`

    console.log(`🚀 GraphQL Gateway is running on: ${serverUrl}`)
    console.log("📡 Webhook proxy available at: /webhooks/*")
    console.log(`📊 Prometheus metrics available at http://localhost:${port}/metrics`)
}
bootstrap()
