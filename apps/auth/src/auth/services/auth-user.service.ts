import { Injectable, Logger } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import {
    GetUserCommandOutput,
    AdminGetUserCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider"
import { AuthUser, AuthResponse } from "../models"
import { AuthErrorHelper } from "../helpers"

@Injectable()
export class AuthUserService {
    private readonly logger = new Logger(AuthUserService.name)

    constructor(private readonly awsCognitoService: AwsCognitoService) {}

    async getUserById(id: string): Promise<AuthUser | null> {
        try {
            this.logger.log(`Getting user by ID: ${id}`)

            const userOutput =
                await this.awsCognitoService.getUserByUsername(id)
            if (!userOutput) {
                return null
            }

            const cognitoUser =
                this.convertAdminGetUserOutputToCognitoUser(userOutput)
            const user = this.mapCognitoUserToAuthUser(cognitoUser)

            this.logger.log(`User retrieved successfully: ${user.id}`)

            return user
        } catch (error) {
            this.logger.error(`Get user by ID failed for ${id}:`, error)
            throw AuthErrorHelper.mapCognitoError(error, "getUserById")
        }
    }

    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return {
            user,
            message: "User validated successfully",
        }
    }

    private convertAdminGetUserOutputToCognitoUser(
        output: AdminGetUserCommandOutput,
    ): CognitoUser {
        const attributes = output.UserAttributes || []
        const getAttr = (name: string) =>
            attributes.find((attr) => attr.Name === name)?.Value || ""

        return {
            sub: output.Username || "",
            email: getAttr("email"),
            emailVerified: getAttr("email_verified") === "true",
            username: output.Username || "",
            name: getAttr("name"),
            phoneNumber: getAttr("phone_number"),
            provider: "cognito",
            cognitoUser: output,
            createdAt: output.UserCreateDate,
            updatedAt: output.UserLastModifiedDate,
        }
    }

    private mapCognitoUserToAuthUser(cognitoUser: CognitoUser): AuthUser {
        return {
            id: cognitoUser.sub,
            email: cognitoUser.email,
            username: cognitoUser.username,
            name: cognitoUser.name,
            phoneNumber: cognitoUser.phoneNumber || "",
            emailVerified: cognitoUser.emailVerified,
            provider: cognitoUser.provider,
            createdAt: cognitoUser.createdAt || new Date(),
            updatedAt: cognitoUser.updatedAt || new Date(),
        }
    }
}
