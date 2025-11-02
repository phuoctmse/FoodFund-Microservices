import { Injectable } from "@nestjs/common"
import {
    GetUserCommandOutput,
    AdminGetUserCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import { AuthUser } from "../models"

@Injectable()
export class CognitoMapperHelper {
    /**
     * Convert GetUserCommandOutput to CognitoUser
     * Used when getting user info from access token
     */
    fromGetUserOutput(output: GetUserCommandOutput): CognitoUser {
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
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    }

    /**
     * Convert AdminGetUserCommandOutput to CognitoUser
     * Used when admin gets user info by username
     */
    fromAdminGetUserOutput(output: AdminGetUserCommandOutput): CognitoUser {
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

    /**
     * Convert CognitoUser to AuthUser (GraphQL model)
     */
    toAuthUser(cognitoUser: CognitoUser): AuthUser {
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
