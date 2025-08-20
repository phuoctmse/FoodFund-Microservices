import { Module } from '@nestjs/common';
import { UsersSubgraphService } from './users-subgraph.service';
import { UsersResolverResolver } from '../resolver/users-resolver.resolver';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace';


@Module({
  providers: [UsersResolverResolver, UsersSubgraphService],
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      plugins: [ApolloServerPluginInlineTrace()],
    }),
  ],
})
export class UsersSubgraphModule {}
