import { Injectable } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { IAuthProvider } from "../../../domain/interfaces/auth-provider.interface"

/**
 * Infrastructure Adapter: Cognito
 * Implements IAuthProvider interface using AWS Cognito
 */
@Injectable()
export class CognitoAdapter implements IAuthProvider {
    constructor(private readonly awsCognitoService: AwsCognitoService) {}

    async signUp(
        email: string,
        password: string,
        attributes: Record<string, string>,
    ): Promise<{ userSub: string }> {
        const result = await this.awsCognitoService.signUp(
            email,
            password,
            attributes,
        )
        return { userSub: result.userSub || "" }
    }

    async signIn(email: string, password: string): Promise<{
        accessToken: string
        refreshToken: string
        idToken: string
        expiresIn: number
    }> {
        const result = await this.awsCognitoService.signIn(email, password)
        return {
            accessToken: result.AccessToken!,
            refreshToken: result.RefreshToken!,
            idToken: result.IdToken!,
            expiresIn: result.ExpiresIn!,
        }
    }

    async getUser(accessToken: string): Promise<{
        sub: string
        email: string
        emailVerified: boolean
        username: string
        name: string
    }> {
        const userOutput = await this.awsCognitoService.getUser(accessToken)
        const attributes = userOutput.UserAttributes || []
        const getAttr = (name: string) =>
            attributes.find((attr) => attr.Name === name)?.Value || ""

        return {
            sub: userOutput.Username || "",
            email: getAttr("email"),
            emailVerified: getAttr("email_verified") === "true",
            username: userOutput.Username || "",
            name: getAttr("name"),
        }
    }

    async signOut(accessToken: string): Promise<{ success: boolean }> {
        const result = await this.awsCognitoService.signOut(accessToken)
        return { success: result.success }
    }

    async refreshToken(
        refreshToken: string,
        userName: string,
    ): Promise<{
        accessToken: string
        idToken: string
        expiresIn: number
    }> {
        const result = await this.awsCognitoService.refreshToken(
            refreshToken,
            userName,
        )
        return {
            accessToken: result.AccessToken!,
            idToken: result.IdToken!,
            expiresIn: result.ExpiresIn!,
        }
    }

    async confirmSignUp(email: string, code: string): Promise<void> {
        await this.awsCognitoService.confirmSignUp(email, code)
    }

    async forgotPassword(email: string): Promise<void> {
        await this.awsCognitoService.forgotPassword(email)
    }

    async confirmForgotPassword(
        email: string,
        code: string,
        newPassword: string,
    ): Promise<void> {
        await this.awsCognitoService.confirmForgotPassword(
            email,
            code,
            newPassword,
        )
    }

    async getUserByUsername(username: string): Promise<{
        sub: string
        email: string
        emailVerified: boolean
        username: string
        name: string
    } | null> {
        const userOutput =
            await this.awsCognitoService.getUserByUsername(username)
        if (!userOutput) return null

        const attributes = userOutput.UserAttributes || []
        const getAttr = (name: string) =>
            attributes.find((attr) => attr.Name === name)?.Value || ""

        return {
            sub: userOutput.Username || "",
            email: getAttr("email"),
            emailVerified: getAttr("email_verified") === "true",
            username: userOutput.Username || "",
            name: getAttr("name"),
        }
    }

    async resendConfirmationCode(email: string): Promise<void> {
        await this.awsCognitoService.resendConfirmationCode(email)
    }

    async changePassword(username: string, newPassword: string): Promise<void> {
        await this.awsCognitoService.changePassword(username, newPassword)
    }

    async deleteUser(email: string): Promise<void> {
        await this.awsCognitoService.adminDeleteUser(email)
    }

    async adminConfirmSignUp(email: string): Promise<void> {
        await this.awsCognitoService.adminConfirmSignUp(email)
    }

    async generateTokensForOAuthUser(
        username: string,
        password?: string,
    ): Promise<{
        AccessToken: string
        RefreshToken: string
        IdToken: string
    }> {
        const result =
            await this.awsCognitoService.generateTokensForOAuthUser(
                username,
                password,
            )
        return {
            AccessToken: result.AccessToken!,
            RefreshToken: result.RefreshToken!,
            IdToken: result.IdToken!,
        }
    }
}
