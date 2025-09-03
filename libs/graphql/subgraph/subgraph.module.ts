import {
    ApolloFederationDriver,
    ApolloFederationDriverConfig,
} from "@nestjs/apollo"
import { Module } from "@nestjs/common"
import { GraphQLModule as NestGraphQLModule } from "@nestjs/graphql"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { ApolloServerPluginInlineTrace } from "@apollo/server/plugin/inlineTrace"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./subgraph.module-definition"

@Module({})
export class GraphQLSubgraphModule extends ConfigurableModuleClass {
    public static forRoot(options: typeof OPTIONS_TYPE = {}) {
        const dynamicModule = super.forRoot(options)

        return {
            ...dynamicModule,
            imports: [
                NestGraphQLModule.forRoot<ApolloFederationDriverConfig>({
                    driver: ApolloFederationDriver,
                    autoSchemaFile: {
                        federation: 2,
                    },
                    plugins: [
                        ApolloServerPluginLandingPageLocalDefault(),
                        ApolloServerPluginInlineTrace(),
                    ],
                    csrfPrevention: false,
                    debug: false,
                    playground: false,
                    path: "/graphql",
                    formatError: (error) => {
                        // Remove the stack trace for production
                        if (process.env.NODE_ENV !== "development") {
                            delete error.extensions?.stacktrace
                        }
                        return {
                            message: error.message,
                            extensions: error.extensions,
                        }
                    },
                }),
            ],
        }
    }
}
