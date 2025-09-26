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
import { UserQueryResolver, UserMutationResolver } from "./resolvers"
import { UserResolver } from "./user.resolver"
import { UserGrpcService } from "./grpc"
import { HealthController } from "./health.controller"
import { GrpcModule } from "libs/grpc"
import {
    UserCreationService,
    UserQueryService,
    UserUpdateService,
    ProfileService,
} from "./services"
import { AwsCognitoModule } from "@libs/aws-cognito"

@Module({
    imports: [
        GrpcModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
    ],
    providers: [
        // Services
        UserService,
        UserRepository,
        UserCreationService,
        UserQueryService,
        UserUpdateService,
        ProfileService,

        // Resolver facade (không có @Resolver decorators)
        UserResolver,

        // GraphQL resolvers (có @Resolver decorators)
        UserQueryResolver,
        UserMutationResolver,

        // Profile resolvers
        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        DeliveryStaffProfileResolver,

        // gRPC
        UserGrpcService,
    ],
    controllers: [HealthController],
    exports: [UserService, UserRepository, UserGrpcService],
})
export class UserModule {}
