import { Module } from "@nestjs/common"
import { getHttpUrl } from "libs/common"
import { Container, envConfig } from "libs/env"
import { GraphQLGatewayModule } from "libs/graphql/gateway"

@Module({
    imports: [
        GraphQLGatewayModule.forRoot({
            subgraphs: (() => {
                const authHost = process.env.AUTH_HOST || envConfig().containers[Container.Auth]?.host || 'auth-service';
                const authPort = parseInt(process.env.AUTH_PORT || '8002') || envConfig().containers[Container.Auth]?.port;
                const userHost = process.env.USERS_SUBGRAPH_HOST || envConfig().containers[Container.UsersSubgraph]?.host || 'user-service';
                const userPort = parseInt(process.env.USERS_SUBGRAPH_PORT || '8003') || envConfig().containers[Container.UsersSubgraph]?.port;
                
                console.log('🔍 Environment Debug:');
                console.log('AUTH_HOST env:', process.env.AUTH_HOST);
                console.log('AUTH_PORT env:', process.env.AUTH_PORT);
                console.log('USERS_SUBGRAPH_HOST env:', process.env.USERS_SUBGRAPH_HOST);
                console.log('USERS_SUBGRAPH_PORT env:', process.env.USERS_SUBGRAPH_PORT);
                console.log('Resolved authHost:', authHost);
                console.log('Resolved authPort:', authPort);
                console.log('Resolved userHost:', userHost);
                console.log('Resolved userPort:', userPort);
                
                const authUrl = getHttpUrl({
                    host: authHost,
                    port: authPort,
                    path: "/graphql",
                });
                const userUrl = getHttpUrl({
                    host: userHost,
                    port: userPort,
                    path: "/graphql",
                });
                
                console.log('🚀 Auth URL:', authUrl);
                console.log('🚀 User URL:', userUrl);
                
                return [
                    {
                        name: "auth",
                        url: authUrl,
                    },
                    {
                        name: "user", 
                        url: userUrl,
                    }
                ];
            })(),
        }),
    ],
    controllers: [],
    providers: [],
})
export class ApiGatewayModule { }
