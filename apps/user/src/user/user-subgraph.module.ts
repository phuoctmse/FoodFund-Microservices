import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { UserService } from "./user.service"
import { UserRepository } from "./user.repository"
import { 
    KitchenStaffProfileResolver, 
    FundraiserProfileResolver, 
    DeliveryStaffProfileResolver,
    DonorProfileResolver, 
} from "./resolvers/profile.resolver"
import { UserResolver } from "./resolvers"

@Module({
    imports: [
        // PrismaModule không cần import vì đã global từ AppModule
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
    ],
    providers: [
        UserService,
        UserRepository,
        UserResolver,
        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        DeliveryStaffProfileResolver
    ],
    exports: [UserService, UserRepository],
})
export class UserSubgraphModule {}