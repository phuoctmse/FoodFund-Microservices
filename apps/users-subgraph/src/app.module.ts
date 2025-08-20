import { Module } from '@nestjs/common';
import { UsersSubgraphModule } from './users/users-subgraph.module';
import { UsersResolverResolver } from './resolver/users-resolver.resolver';

@Module({
  imports: [UsersSubgraphModule],
  controllers: [],
  providers: [UsersResolverResolver],
})
export class AppModule {}