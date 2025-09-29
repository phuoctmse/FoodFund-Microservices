import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { 
    UserRepository,
    // Role-based repositories
    UserAdminRepository,
    UserCommonRepository,
    DonorRepository,
    KitchenStaffRepository,
    FundraiserRepository,
    DeliveryStaffRepository,
} from "./repositories"
import {
    // Admin resolvers
    UserAdminResolver,
    
    // Role-based resolvers
    DonorProfileResolver,
    FundraiserProfileResolver,
    KitchenStaffProfileResolver,
    DeliveryStaffProfileResolver,
    
    // General resolvers
    UserQueryResolver,
    UserMutationResolver,
} from "./resolvers"
import { 
    UserGrpcService,
    // Role-based gRPC services
    UserCommonGrpcService,
    UserAdminGrpcService,
} from "./grpc"
import { HealthController } from "./health.controller"
import { GrpcModule } from "libs/grpc"
import {
    // Admin services
    UserAdminService,
    
    // Role-based services
    DonorService,
    FundraiserService,
    KitchenStaffService,
    DeliveryStaffService,
    
    // General services
    UserQueryService as GeneralUserQueryService,
    UserMutationService as GeneralUserMutationService,
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
        // Core repositories
        UserRepository,
        
        // Role-based repositories
        UserAdminRepository,
        UserCommonRepository,
        DonorRepository,
        KitchenStaffRepository,
        FundraiserRepository,
        DeliveryStaffRepository,
        
        // Admin services
        UserAdminService,
        
        // Role-based services
        DonorService,
        FundraiserService,
        KitchenStaffService,
        DeliveryStaffService,
        
        // General services
        GeneralUserQueryService,
        GeneralUserMutationService,



        // GraphQL resolvers (có @Resolver decorators)
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,

        // Profile resolvers
        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        DeliveryStaffProfileResolver,

        // gRPC services
        UserGrpcService,
        UserCommonGrpcService,
        UserAdminGrpcService,
    ],
    controllers: [HealthController],
    exports: [UserRepository, UserGrpcService],
})
export class UserModule {}
