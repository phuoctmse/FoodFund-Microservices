import { Observable } from "rxjs"

/**
 * gRPC Auth Service Interface
 * Generated from auth.proto
 */

// Messages
export interface AuthUser {
    id: string
    cognito_id: string
    email: string
    username: string
    name: string
    provider: string
    roles: string[]
    attributes: Record<string, string>
}

// Request/Response types
export interface ValidateTokenRequest {
    access_token: string
}

export interface ValidateTokenResponse {
    valid: boolean
    user: AuthUser | null
    error: string | null
    expires_at: number
}

export interface GetUserFromTokenRequest {
    access_token: string
}

export interface GetUserFromTokenResponse {
    success: boolean
    user: AuthUser | null
    error: string | null
}

export interface RefreshTokenRequest {
    refresh_token: string
}

export interface RefreshTokenResponse {
    success: boolean
    access_token: string
    refresh_token: string
    expires_in: number
    error: string | null
}

export interface CheckPermissionRequest {
    user_id: string
    resource: string
    action: string
}

export interface CheckPermissionResponse {
    allowed: boolean
    reason: string
}

// Service Interface
export interface IAuthGrpcService {
    validateToken(
        data: ValidateTokenRequest,
    ): Observable<ValidateTokenResponse>
    getUserFromToken(
        data: GetUserFromTokenRequest,
    ): Observable<GetUserFromTokenResponse>
    refreshToken(data: RefreshTokenRequest): Observable<RefreshTokenResponse>
    checkPermission(
        data: CheckPermissionRequest,
    ): Observable<CheckPermissionResponse>
}
