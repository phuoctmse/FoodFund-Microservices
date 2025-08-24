import { Module } from '@nestjs/common';
import { UsersSubgraphService } from './service/users-subgraph.service';
import { UsersResolver } from './resolver/users.resolver';
import { GraphQLSubgraphModule } from 'libs/graphql/subgraph';
import { PrismaModule } from 'libs/databases';

@Module({
  providers: [UsersResolver, UsersSubgraphService],
  imports: [
    PrismaModule.forRoot({
      isGlobal: true,
      enableLogging: true,
      logLevel: ['query', 'error']
    }),
    GraphQLSubgraphModule.forRoot({
      debug: true,
      playground: true,
    }),
  ],
})
export class UsersSubgraphModule {}
