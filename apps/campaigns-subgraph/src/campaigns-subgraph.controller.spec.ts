import { Test, TestingModule } from "@nestjs/testing"
import { CampaignsSubgraphController } from "./campaigns-subgraph.controller"
import { CampaignsSubgraphService } from "./campaigns-subgraph.service"

describe("CampaignsSubgraphController", () => {
    let campaignsSubgraphController: CampaignsSubgraphController

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [CampaignsSubgraphController],
            providers: [CampaignsSubgraphService],
        }).compile()

        campaignsSubgraphController = app.get<CampaignsSubgraphController>(
            CampaignsSubgraphController,
        )
    })

    describe("root", () => {
        it("should return \"Hello World!\"", () => {
            expect(campaignsSubgraphController.getHello()).toBe("Hello World!")
        })
    })
})
