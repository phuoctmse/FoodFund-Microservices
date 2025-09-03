import { NestFactory } from "@nestjs/core"
import { ApiGatewayModule } from "./app.module"

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule)

    const port = process.env.PORT ?? 8000
    await app.listen(port)

    console.log(
        `🚀 GraphQL Gateway is running on: http://localhost:${port}/graphql`,
    )
}
bootstrap()
