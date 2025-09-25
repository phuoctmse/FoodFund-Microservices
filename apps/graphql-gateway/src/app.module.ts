import { Module } from "@nestjs/common"
import { getHttpUrl } from "libs/common"
import { Container, envConfig } from "libs/env"
import { GraphQLGatewayModule } from "libs/graphql/gateway"

@Module({
    imports: [
        GraphQLGatewayModule.forRoot({
            subgraphs: (() => {
                const authHost =
                    process.env.AUTH_HOST ||
                    envConfig().containers[Container.Auth]?.host ||
                    "auth-service"
                const authPort =
                    parseInt(process.env.AUTH_PORT || "8002") ||
                    envConfig().containers[Container.Auth]?.port
                const userHost =
                    process.env.USERS_SUBGRAPH_HOST ||
                    envConfig().containers[Container.UsersSubgraph]?.host ||
                    "user-service"
                const userPort =
                    parseInt(process.env.USERS_SUBGRAPH_PORT || "8003") ||
                    envConfig().containers[Container.UsersSubgraph]?.port
                const campaignHost =
                    process.env.CAMPAIGNS_SUBGRAPH_HOST ||
                    envConfig().containers[Container.CampaignsSubgraph]?.host ||
                    "campaign-service"
                const campaignPort =
                    parseInt(process.env.CAMPAIGNS_SUBGRAPH_PORT || "8004") ||
                    envConfig().containers[Container.CampaignsSubgraph]?.port

                const authUrl = getHttpUrl({
                    host: authHost,
                    port: authPort,
                    path: "/graphql",
                })
                const userUrl = getHttpUrl({
                    host: userHost,
                    port: userPort,
                    path: "/graphql",
                })
                const campaignUrl = getHttpUrl({
                    host: campaignHost,
                    port: campaignPort,
                    path: "/graphql",
                })

                return [
                    {
                        name: "auth",
                        url: authUrl,
                    },
                    {
                        name: "user",
                        url: userUrl,
                    },
                    {
                        name: "campaign",
                        url: campaignUrl,
                        retryOptions: {
                            retries: 3,
                            initialDelayMs: 500,
                            maxDelayMs: 3000,
                            factor: 2,
                        },
                        circuitBreakerOptions: {
                            failureThreshold: 5,
                            resetTimeoutMs: 30000,
                        },
                        fallback: {
                            response: {
                                data: null,
                                errors: [
                                    {
                                        message:
                                            "Campaign service temporarily unavailable",
                                        extensions: {
                                            code: "SERVICE_UNAVAILABLE",
                                        },
                                    },
                                ],
                            },
                        },
                    },
                ]
            })(),
            gatewayRetryOptions: {
                maxRetries: 5,
                initialDelayMs: 2000,
                maxDelayMs: 10000,
                factor: 2,
            },
            monitoring: {
                onEvent: (event) => {
                    const timestamp = new Date().toISOString()
                    switch (event.type) {
                    case "retry":
                        console.log(
                            `🔄 [${timestamp}] Retrying ${event.subgraph}: ${JSON.stringify(event.details)}`,
                        )
                        break
                    case "circuitOpen":
                        console.warn(
                            `⚡ [${timestamp}] Circuit opened for ${event.subgraph}: ${JSON.stringify(event.details)}`,
                        )
                        break
                    case "circuitClose":
                        console.log(
                            `✅ [${timestamp}] Circuit closed for ${event.subgraph}`,
                        )
                        break
                    case "fallback":
                        console.warn(
                            `🔀 [${timestamp}] Using fallback for ${event.subgraph}: ${JSON.stringify(event.details)}`,
                        )
                        break
                    case "error":
                        console.error(
                            `❌ [${timestamp}] Error in ${event.subgraph}: ${JSON.stringify(event.details)}`,
                        )
                        break
                    case "subgraphError":
                        console.warn(
                            `⚠️  [${timestamp}] Subgraph error in ${event.subgraph}: ${JSON.stringify(event.details)}`,
                        )
                        break
                    }
                },
            },
        }),
    ],
    controllers: [],
    providers: [],
})
export class ApiGatewayModule {}
