import { Module } from "@nestjs/common"
import { GraphQLGatewayModule } from "libs/graphql/gateway"

@Module({
    imports: [
        GraphQLGatewayModule.forRoot({
            subgraphs: [
                {
                    name: "auth",
                    url: "http://localhost:8002/graphql",
                },
            ],
        }),
    ],
    controllers: [],
    providers: [],
})
export class ApiGatewayModule {}
