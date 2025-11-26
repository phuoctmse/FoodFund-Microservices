import { Injectable, Logger } from "@nestjs/common"
import { AuthUser, CreateStaffAccountResponse } from "../../../domain/entities"
import { AwsCognitoService } from "libs/aws-cognito"
import { AuthErrorHelper } from "../../../shared/helpers"
import { GrpcClientService } from "libs/grpc"
import { Role } from "../../../domain/enums/role.enum"

@Injectable()
export class AuthAdminService {
    private readonly logger = new Logger(AuthAdminService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
    ) { }

    private mapRoleToProtoEnum(role: Role): number {
        switch (role) {
        case Role.DONOR:
            return 0
        case Role.FUNDRAISER:
            return 1
        case Role.KITCHEN_STAFF:
            return 2
        case Role.DELIVERY_STAFF:
            return 3
        case Role.ADMIN:
            return 4
        default:
            throw new Error(`Invalid role: ${role}`)
        }
    }
}
