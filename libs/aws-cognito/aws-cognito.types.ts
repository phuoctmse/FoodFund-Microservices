import {
    GetUserCommandOutput,
    AdminGetUserCommandOutput,
    AttributeType,
} from "@aws-sdk/client-cognito-identity-provider"

// Module options interface
export interface AwsCognitoModuleOptions {
    userPoolId?: string
    clientId?: string
    clientSecret?: string
    region?: string
    isGlobal?: boolean
    mockMode?: boolean // For development/testing
}

export interface CognitoUser {
    sub: string // Cognito user ID (equivalent to Firebase uid)
    email: string
    emailVerified: boolean
    username: string
    name: string
    givenName?: string
    familyName?: string
    picture?: string
    phoneNumber?: string
    phoneNumberVerified?: boolean
    groups?: string[]
    customAttributes?: Record<string, string>
    cognitoUser: GetUserCommandOutput | AdminGetUserCommandOutput // Raw Cognito user object
    provider: string
    createdAt?: Date
    updatedAt?: Date
}

export interface AuthResponse {
    user: CognitoUser
    message: string
}

// JWT payload interface from Cognito
export interface CognitoJwtPayload {
    sub: string
    email_verified: boolean
    iss: string
    "cognito:username": string
    "cognito:groups"?: string[]
    aud: string
    event_id: string
    token_use: string
    auth_time: number
    exp: number
    iat: number
    jti: string
    email?: string
    name?: string
    given_name?: string
    family_name?: string
    picture?: string
    phone_number?: string
    phone_number_verified?: boolean
    // For custom attributes - more specific than any
    [key: `custom:${string}`]: string
}

// Use AWS SDK AttributeType directly
export type CognitoUserAttribute = AttributeType

export interface AuthenticationResult {
    AccessToken?: string
    RefreshToken?: string
    IdToken?: string
    ExpiresIn?: number
    TokenType?: string
}

export interface GuardConstructor {
    new (...args: unknown[]): unknown
}

// Sign up response interface
export interface SignUpResponse {
    userSub?: string
    codeDeliveryDetails?: {
        Destination?: string
        DeliveryMedium?: string
        AttributeName?: string
    }
    userConfirmed?: boolean
}

// Confirmation response interface
export interface ConfirmationResponse {
    confirmed: boolean
}

// Resend code response interface
export interface ResendCodeResponse {
    codeDeliveryDetails?: {
        Destination?: string
        DeliveryMedium?: string
        AttributeName?: string
    }
}

// Password reset response interface
export interface PasswordResetResponse {
    passwordReset: boolean
}
