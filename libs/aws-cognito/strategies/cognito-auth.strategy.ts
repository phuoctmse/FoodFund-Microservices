import { Injectable, UnauthorizedException } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-custom"
import { Request } from "express"
import { AwsCognitoService } from "../aws-cognito.service"
import { CognitoUser } from "../aws-cognito.types"

@Injectable()
export class CognitoAuthStrategy extends PassportStrategy(
    Strategy,
    "cognito-auth",
) {
    constructor(private readonly cognitoService: AwsCognitoService) {
        super()
    }

    async validate(req: Request): Promise<CognitoUser> {
        try {
            const authHeader = req.headers?.authorization
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                throw new UnauthorizedException(
                    "No valid authorization header found",
                )
            }

            const token = authHeader.substring(7)
            const decodedToken = await this.cognitoService.validateToken(token)
            ;(req as any).decodedToken = decodedToken
            const cognitoUserResponse = await this.cognitoService.getUser(token)

            const user: CognitoUser = {
                sub: decodedToken.sub,
                email:
                    (decodedToken as any).email ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "email",
                    ) ||
                    "",
                emailVerified: (decodedToken as any).email_verified || false,
                username:
                    (decodedToken as any)["cognito:username"] ||
                    cognitoUserResponse.Username ||
                    "",
                name:
                    (decodedToken as any).name ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "name",
                    ),
                givenName:
                    (decodedToken as any).given_name ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "given_name",
                    ),
                familyName:
                    (decodedToken as any).family_name ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "family_name",
                    ),
                picture:
                    (decodedToken as any).picture ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "picture",
                    ),
                phoneNumber:
                    (decodedToken as any).phone_number ||
                    this.cognitoService.getAttributeValue(
                        cognitoUserResponse.UserAttributes || [],
                        "phone_number",
                    ),
                phoneNumberVerified:
                    (decodedToken as any).phone_number_verified || false,
                groups: (decodedToken as any)["cognito:groups"] || [],
                customAttributes: this.cognitoService.extractCustomAttributes(
                    cognitoUserResponse.UserAttributes || [],
                ),
                cognitoUser: cognitoUserResponse,
                provider: "cognito",
                createdAt: undefined,
                updatedAt: undefined,
            }

            return user
        } catch (error) {
            throw new UnauthorizedException(
                "Invalid Cognito token or user not found",
            )
        }
    }
}
