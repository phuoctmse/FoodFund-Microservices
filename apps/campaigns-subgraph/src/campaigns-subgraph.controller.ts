import { Controller, Get } from "@nestjs/common"
import { CampaignsSubgraphService } from "./campaigns-subgraph.service"

@Controller()
export class CampaignsSubgraphController {
    constructor(
    private readonly campaignsSubgraphService: CampaignsSubgraphService,
    ) {}

  @Get()
    getHello(): string {
        return this.campaignsSubgraphService.getHello()
    }
}
