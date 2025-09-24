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

@Module({})
export class GraphQLGatewayModule extends ConfigurableModuleClass {
    //gateway
    public static forRoot(options: typeof OPTIONS_TYPE) {
        const subgraphs = options.subgraphs ?? []
        const retryDefaults = options.retryOptions
        const circuitDefaults = options.circuitBreakerOptions
        const monitoring = options.monitoring
        const fallback = options.fallback

        const dynamicModule = super.forRoot(options)
        return {
            ...dynamicModule,
            imports: [
                NestGraphQLModule.forRoot<ApolloGatewayDriverConfig>({
                    driver: ApolloGatewayDriver,
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
                        supergraphSdl: new IntrospectAndCompose({
                            subgraphs,
                            introspectionHeaders: {},
                            pollIntervalInMs:
                                (options as any).pollIntervalInMs ?? 30000,
                        }),
                    },
                }),
            ],
        }
    }
}
