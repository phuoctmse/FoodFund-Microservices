import { Injectable } from "@nestjs/common"

@Injectable()
export class CampaignsSubgraphService {
    getHello(): string {
        return "Hello World!"
    }
}
