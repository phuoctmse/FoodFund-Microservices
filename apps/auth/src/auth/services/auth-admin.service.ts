import { Injectable, Logger } from "@nestjs/common"
import { AuthUser, CreateStaffAccountResponse } from "../models"
import { AwsCognitoService } from "libs/aws-cognito"
import { CreateStaffAccountInput } from "../dto"
import { Role } from "libs/databases/prisma/schemas/enums/user.enums"
import { AuthErrorHelper } from "../helpers"
import { GrpcClientService } from "libs/grpc"

@Injectable()
export class AuthAdminService {
    private readonly logger = new Logger(AuthAdminService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
    ) {}

    async createStaffAccount(
        input: CreateStaffAccountInput,
        adminUser: AuthUser,
    ): Promise<CreateStaffAccountResponse> {
        function extractUserNameFromEmail(email: string): string {
            if (typeof email !== "string") return ""
            const atIndex = email.indexOf("@")
            if (atIndex > 0) {
                return email.substring(0, atIndex)
            }
            return ""
        }
        try {
            this.logger.log(
                `Admin ${adminUser.id} creating staff account for: ${input.email}`,
            )

            // Validate role is a staff role
            if (
                input.role !== Role.KITCHEN_STAFF &&
                input.role !== Role.DELIVERY_STAFF &&
                input.role !== Role.FUNDRAISER
            ) {
                throw new Error(
                    "Only Kitchen Staff, Delivery Staff, and Fundraiser can be created through this endpoint",
                )
            }

            // Create user in Cognito with provided password
            const cognitoResult = await this.awsCognitoService.signUp(
                input.email,
                input.password,
                {
                    name: input.full_name,
                    phone_number: input.phone_number,
                },
            )

            this.logger.log(`Cognito user created: ${cognitoResult.userSub}`)

            // Auto-confirm all staff roles (bypass email confirmation for development)
            await this.awsCognitoService.adminConfirmSignUp(input.email)
            this.logger.log(`Auto-confirmed ${input.role} user: ${input.email}`)

            // Create user in database via gRPC
            const userResult = await this.grpcClient.callUserService(
                "CreateStaffUser",
                {
                    cognito_id: cognitoResult.userSub || "",
                    email: input.email,
                    username: extractUserNameFromEmail(input.email),
                    full_name: input.full_name,
                    phone_number: input.phone_number,
                    avatar_url: input.avatar_url || "",
                    role: this.mapRoleToProtoEnum(input.role),
                    bio: input.bio || "",
                    organization_address: input.organization_address || "",
                },
            )

            if (!userResult.success) {
                // Rollback Cognito user if database creation fails
                // Note: We'll need to implement adminDeleteUser in AwsCognitoService
                throw new Error(
                    `Failed to create user in database: ${userResult.error}`,
                )
            }

            this.logger.log(
                `Staff account created successfully: ${userResult.user.id}`,
            )

            return {
                success: true,
                message: `${input.role} account created successfully and auto-confirmed. Ready to login immediately.`,
                userId: userResult.user.id,
                cognitoId: cognitoResult.userSub || "",
                hasLoginAccess: true,
                temporaryPasswordSent: false,
            }
        } catch (error) {
            this.logger.error(
                `Staff account creation failed for ${input.email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "createStaffAccount",
                input.email,
            )
        }
    }

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
