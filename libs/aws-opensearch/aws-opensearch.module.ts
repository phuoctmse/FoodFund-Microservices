import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { OpenSearchService } from "./aws-opensearch.service"

@Module({
    imports: [ConfigModule],
    providers: [OpenSearchService],
    exports: [OpenSearchService],
})
export class OpenSearchModule {}
