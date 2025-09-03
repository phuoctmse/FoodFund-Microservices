import { Module } from "@nestjs/common"
import { CampaignsSubgraphController } from "./campaigns-subgraph.controller"
import { CampaignsSubgraphService } from "./campaigns-subgraph.service"

@Module({
    imports: [],
    controllers: [CampaignsSubgraphController],
    providers: [CampaignsSubgraphService],
})
export class CampaignsSubgraphModule {}
