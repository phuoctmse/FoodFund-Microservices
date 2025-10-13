import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { PrismaClient } from "../generated/user-client"
import { PrismaUserService } from "./prisma-user.service"
import { 
    UserRepository,
    // Role-based repositories
    UserAdminRepository,
    UserCommonRepository,
    KitchenStaffRepository,
    FundraiserRepository,
    DeliveryStaffRepository,
} from "./repositories"
import { OrganizationRepository } from "./repositories/organization"
import {
    UserAdminResolver,

    DonorProfileResolver,
    FundraiserProfileResolver,
    KitchenStaffProfileResolver,
    DeliveryStaffProfileResolver,

    UserQueryResolver,
    UserMutationResolver,
} from "./resolvers"
import {
    UserGrpcService,
    UserCommonGrpcService,
    UserAdminGrpcService,
} from "./grpc"
import { HealthController } from "./health.controller"
import { GrpcModule } from "libs/grpc"
import {
    UserAdminService,

    DonorService,
    FundraiserService,
    KitchenStaffService,
    DeliveryStaffService,

    UserQueryService as GeneralUserQueryService,
    UserMutationService as GeneralUserMutationService,
} from "./services"
import { OrganizationService } from "./services/organization/organization.service"
import { DataLoaderFactory } from "./services/common/dataloader.factory"
import { DataLoaderService } from "./services/common/dataloader.service"
import { AwsCognitoModule } from "@libs/aws-cognito"

@Module({
    imports: [
        GrpcModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
            federationVersion: 2,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
    ],
    providers: [
        PrismaUserService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaUserService) => service["client"],
            inject: [PrismaUserService],
        },
        
        UserRepository,
        OrganizationRepository,

        UserAdminRepository,
        UserCommonRepository,
        KitchenStaffRepository,
        FundraiserRepository,
        DeliveryStaffRepository,

        UserAdminService,
        OrganizationService,
        
        DataLoaderFactory,
        DataLoaderService,

        DonorService,
        FundraiserService,
        KitchenStaffService,
        DeliveryStaffService,

        GeneralUserQueryService,
        GeneralUserMutationService,

        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,

        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        DeliveryStaffProfileResolver,

        UserGrpcService,
        UserCommonGrpcService,
        UserAdminGrpcService,
    ],
    controllers: [HealthController],
    exports: [UserRepository, UserGrpcService],
})
export class UserModule {}
