import { ApolloFederationDriver, ApolloFederationDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { GraphQLModule as NestGraphQLModule } from "@nestjs/graphql";
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./subgraph.module-definition";

@Module({})
export class GraphQLSubgraphModule extends ConfigurableModuleClass {
    public static forRoot(options: typeof OPTIONS_TYPE = {}) {
        const {
            debug = false,
            playground = false,
            path = "/graphql"
        } = options;

        const dynamicModule = super.forRoot(options);
        
        return {
            ...dynamicModule,
            imports: [
                NestGraphQLModule.forRoot<ApolloFederationDriverConfig>({
                    driver: ApolloFederationDriver,
                    autoSchemaFile: {
                        federation: 2,
                    },
                    plugins: [ApolloServerPluginInlineTrace()],
                    debug,
                    playground,
                    path,
                    formatError: (error) => {
                        // Remove the stack trace for production
                        if (!debug) {
                            delete error.extensions?.stacktrace;
                        }
                        return {
                            message: error.message,
                            extensions: error.extensions,
                        };
                    }
                })
            ],
        };
    }
}
