import { Module } from "@nestjs/common"
import { AuthSubgraphService } from "./auth.service"
import { AuthResolver } from "./resolver"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "libs/aws-cognito"

@Module({
    providers: [AuthResolver, AuthSubgraphService],
    imports: [
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: true,
            mockMode: false, // Enable for development without AWS credentials
        }),
    ],
    exports: [AuthSubgraphService],
})
export class AuthSubgraphModule {}
