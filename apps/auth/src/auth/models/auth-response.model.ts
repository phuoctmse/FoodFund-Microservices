// apps/auth/src/auth/models/auth-response.model.ts - Mở rộng
import { Field, ObjectType } from "@nestjs/graphql"
import { AuthUser } from "./auth-user.model"

@ObjectType()
export class AuthResponse {
    @Field(() => AuthUser)
        user: AuthUser

    @Field()
        message: string
}

@ObjectType()
export class SignUpResponse {
    @Field()
        userSub: string

    @Field()
        message: string

    @Field()
        emailSent: boolean
}

@ObjectType()
export class SignInResponse {
    @Field(() => AuthUser)
        user: AuthUser

    @Field()
        accessToken: string

    @Field()
        refreshToken: string

    @Field()
        idToken: string

    @Field()
        expiresIn: number

    @Field()
        message: string
}

@ObjectType()
export class ConfirmSignUpResponse {
    @Field()
        confirmed: boolean

    @Field()
        message: string
}

@ObjectType()
export class ForgotPasswordResponse {
    @Field()
        emailSent: boolean

    @Field()
        message: string
}

@ObjectType()
export class ResetPasswordResponse {
    @Field()
        passwordReset: boolean

    @Field()
        message: string
}

@ObjectType()
export class ResendCodeResponse {
    @Field()
        emailSent: boolean

    @Field()
        message: string
}

@ObjectType()
export class RefreshTokenResponse {
    @Field()
        accessToken: string

    @Field()
        idToken: string

    @Field()
        expiresIn: number

    @Field()
        message: string
}

@ObjectType()
export class CreateStaffAccountResponse {
    @Field()
        success: boolean

    @Field()
        message: string

    @Field()
        userId: string

    @Field()
        cognitoId: string

    @Field()
        hasLoginAccess: boolean

    @Field()
        temporaryPasswordSent: boolean
}


