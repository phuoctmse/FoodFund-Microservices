/**
 * Application DTOs: Sign In
 * Data Transfer Objects for sign in operation
 */

export class SignInDto {
    email: string
    password: string
}

export class SignInResponseDto {
    accessToken: string
    refreshToken: string
    idToken: string
    expiresIn: number
    user: {
        id: string
        email: string
        username: string
        name: string
        emailVerified: boolean
        provider: string
        createdAt?: Date
        updatedAt?: Date
    }
    message: string
}
