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
import { UserGrpcService } from "./grpc"
import { HealthController } from "./health.controller"
import { GrpcModule } from "libs/grpc"

@Module({
    imports: [
        GrpcModule,
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
        DeliveryStaffProfileResolver,
        UserGrpcService,
    ],
    controllers: [HealthController],
    exports: [UserService, UserRepository, UserGrpcService],
})
export class UserModule {}
