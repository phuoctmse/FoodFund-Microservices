import { Module } from '@nestjs/common';
import { UsersSubgraphService } from './service/users-subgraph.service';
import { UsersResolver } from './resolver/users.resolver';
import { GraphQLSubgraphModule } from 'libs/graphql/subgraph';
import { 
  PrismaModule, 
  UserRepository, 
  CampaignRepository, 
  DonationRepository 
} from 'libs/databases';

@Module({
  providers: [UsersResolver, UsersSubgraphService],
  imports: [
    PrismaModule.forRoot(),
    PrismaModule.forFeature([
      UserRepository,
      CampaignRepository,
      DonationRepository
    ]),
    GraphQLSubgraphModule.forRoot(),
  ],
})
export class UsersSubgraphModule {}
