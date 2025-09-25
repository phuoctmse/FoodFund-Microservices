import { IntrospectAndCompose } from "@apollo/gateway"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from "@nestjs/apollo"
import { Module } from "@nestjs/common"
import { GraphQLModule as NestGraphQLModule } from "@nestjs/graphql"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./gateway.module-definition"
import {
    DefaultRemoteGraphQLDataSource,
    DataSourceOptions,
} from "./default.remote-graphql-data-source"
import { ResilientIntrospectAndCompose } from "./resilient-introspect-compose"

@Module({})
export class GraphQLGatewayModule extends ConfigurableModuleClass {
    //gateway
    public static forRoot(options: typeof OPTIONS_TYPE) {
        const subgraphs = options.subgraphs ?? []
        const retryDefaults = options.retryOptions
        const circuitDefaults = options.circuitBreakerOptions
        const monitoring = options.monitoring
        const fallback = options.fallback
        const gatewayRetryOptions = options.gatewayRetryOptions

        const dynamicModule = super.forRoot(options)
        return {
            ...dynamicModule,
            imports: [
                NestGraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
                    driver: ApolloGatewayDriver,
                    useFactory: async () => {
                        // Create resilient supergraph manager
                        const resilientManager = new ResilientIntrospectAndCompose({
                            subgraphs,
                            retryOptions: gatewayRetryOptions,
                            onSubgraphUnavailable: (subgraphName, error) => {
                                console.warn(`🚨 Subgraph "${subgraphName}" is unavailable:`, error.message)
                                monitoring?.onEvent?.({
                                    type: "error",
                                    subgraph: subgraphName,
                                    details: { error: error.message },
                                })
                            },
                        })

                        const supergraphManager = await resilientManager.createSupergraphManager()

                        return {
                            server: {
                                plugins: [ApolloServerPluginLandingPageLocalDefault()],
                                context: ({ req, res }) => ({ req, res }),
                                debug: false,
                                csrfPrevention: false,
                                playground: false,
                                path: "/graphql",
                                formatError: (error) => {
                                    // remove the stack trace
                                    delete error.extensions?.stacktrace
                                    return {
                                        message: error.message, // Only show the error message
                                        extensions: error.extensions,
                                    }
                                },
                                
                            },
                            gateway: {
                                buildService: ({ url, name }) => {
                                    const sub = subgraphs.find(
                                        (s) => s.url === url || s.name === name,
                                    ) as any
                                    const dsOptions: DataSourceOptions = {
                                        url: url!,
                                        subgraphName: name ?? sub?.name ?? url!,
                                        retryOptions:
                                            sub?.retryOptions ?? retryDefaults,
                                        circuitBreakerOptions:
                                            sub?.circuitBreakerOptions ??
                                            circuitDefaults,
                                        fallback: sub?.fallback ?? fallback,
                                        monitoring,
                                    }
                                    return new DefaultRemoteGraphQLDataSource(dsOptions)
                                },
                                supergraphSdl: supergraphManager,
                            },
                        }
                    },
                }),
            ],
        }
    }
}
