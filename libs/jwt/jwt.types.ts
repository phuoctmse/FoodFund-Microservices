import { UserProfileSchema } from "libs/databases"

export interface BaseOptions {
    isGlobal?: boolean
    useGlobalImports?: boolean
}

export type UserLike = Partial<UserProfileSchema> & {
    id: string
    refresh?: boolean
}

export interface AuthCredentials {
    accessToken: string
    refreshToken: RefreshToken
}

export interface RefreshToken {
    token: string
    expiredAt: Date
}

export type JwtOptions = BaseOptions

export enum AuthCredentialType {
    AccessToken = "accessToken",
    RefreshToken = "refreshToken",
}
