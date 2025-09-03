import { NestFactory } from "@nestjs/core"
import { CampaignsSubgraphModule } from "./campaigns-subgraph.module"

async function bootstrap() {
    const app = await NestFactory.create(CampaignsSubgraphModule)
    await app.listen(process.env.port ?? 3000)
}
bootstrap()
