import { Module } from "@nestjs/common"
import { AuthLibModule } from "libs/auth/auth.module"
import { CampaignService } from "./campaign.service"
import { CampaignResolver } from "./campaign.resolver"
import { CampaignRepository } from "./campaign.repository"
import { JwtModule } from "@libs/jwt"
import { HealthController } from "./health.controller"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { AwsCognitoModule } from "@libs/aws-cognito"

@Module({
    imports: [
        GraphQLSubgraphModule.forRoot({
            debug: process.env.NODE_ENV === "development",
            playground: process.env.NODE_ENV === "development",
            federationVersion: 2,
            path: "/graphql",
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        AuthLibModule,
        JwtModule.register({
            isGlobal: false,
            useGlobalImports: true,
        }),
    ],
    providers: [CampaignService, CampaignResolver, CampaignRepository],
    controllers: [HealthController],
    exports: [CampaignService, CampaignRepository],
})
export class CampaignModule {}
