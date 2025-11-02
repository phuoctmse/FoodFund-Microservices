import { Observable } from "rxjs"

/**
 * gRPC User Service Interface
 * Generated from user.proto
 */

// Enums
export enum Role {
    DONOR = 0,
    FUNDRAISER = 1,
    KITCHEN_STAFF = 2,
    DELIVERY_STAFF = 3,
    ADMIN = 4,
}

// Messages
export interface User {
    id: string
    cognito_id: string
    email: string
    username: string
    full_name: string
    phone_number: string
    avatar_url: string
    bio: string
    role: Role
    is_active: boolean
    created_at: string
    updated_at: string
}

// Request/Response types
export interface CreateUserRequest {
    cognito_id: string
    email: string
    username: string
    full_name: string
}

export interface CreateUserResponse {
    success: boolean
    user: User | null
    error: string | null
}

export interface CreateStaffUserRequest {
    cognito_id: string
    email: string
    username: string
    full_name: string
    role: Role
}

export interface CreateStaffUserResponse {
    success: boolean
    user: User | null
    error: string | null
}

export interface GetUserRequest {
    id: string
}

export interface GetUserResponse {
    success: boolean
    user: User | null
    error: string | null
}

export interface UpdateUserRequest {
    id: string
    full_name?: string
    phone_number?: string
    avatar_url?: string
    bio?: string
}

export interface UpdateUserResponse {
    success: boolean
    user: User | null
    error: string | null
}

export interface UserExistsRequest {
    cognito_id?: string
    email?: string
}

export interface UserExistsResponse {
    exists: boolean
    error: string | null
}

export interface GetUserByEmailRequest {
    email: string
}

// Service Interface
export interface IUserGrpcService {
    createUser(data: CreateUserRequest): Observable<CreateUserResponse>
    createStaffUser(
        data: CreateStaffUserRequest,
    ): Observable<CreateStaffUserResponse>
    getUser(data: GetUserRequest): Observable<GetUserResponse>
    updateUser(data: UpdateUserRequest): Observable<UpdateUserResponse>
    userExists(data: UserExistsRequest): Observable<UserExistsResponse>
    getUserByEmail(data: GetUserByEmailRequest): Observable<GetUserResponse>
}
