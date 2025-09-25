import { ObjectType, Field } from "@nestjs/graphql"
import { AbstractSchema } from "./abstract.schema"

@ObjectType({
    description: "User authentication schema",
})
export class UserAuthSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Reference to User ID in users service",
    })
        userId: string

    @Field(() => String, {
        description: "User email for authentication",
    })
        email: string

    @Field(() => String, {
        nullable: true,
        description: "OAuth provider (google, facebook, etc.)",
    })
        provider?: string

    @Field(() => String, {
        nullable: true,
        description: "Provider user ID",
    })
        providerId?: string

    @Field(() => Boolean, {
        description: "Whether the user is verified",
        defaultValue: false,
    })
        isVerified: boolean

    @Field(() => Date, {
        nullable: true,
        description: "Last login timestamp",
    })
        lastLoginAt?: Date
}

@ObjectType({
    description: "Refresh token schema",
})
export class RefreshTokenSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Refresh token value",
    })
        token: string

    @Field(() => String, {
        description: "User ID who owns this token",
    })
        userId: string

    @Field(() => Date, {
        description: "Token expiration date",
    })
        expiresAt: Date
}

@ObjectType({
    description: "Verification token schema",
})
export class VerificationTokenSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Email address for verification",
    })
        email: string

    @Field(() => String, {
        description: "Verification token",
    })
        token: string

    @Field(() => String, {
        description: "Token type (email_verification, password_reset)",
    })
        type: string

    @Field(() => Date, {
        description: "Token expiration date",
    })
        expiresAt: Date
}

// Input types for Auth operations
export interface CreateUserAuthInput {
    userId: string
    email: string
    passwordHash?: string
    provider?: string
    providerId?: string
}

export interface CreateRefreshTokenInput {
    token: string
    userId: string
    expiresAt: Date
}

export interface CreateVerificationTokenInput {
    email: string
    token: string
    type: string
    expiresAt: Date
}
