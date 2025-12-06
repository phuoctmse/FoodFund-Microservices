/**
 * Port/Interface for User Service Communication
 * This is a domain-level abstraction that doesn't depend on any specific implementation (gRPC, HTTP, etc.)
 */

export interface UserDto {
    id: string
    cognitoId: string
    email: string
    isActive: boolean
}

export interface GetUserResponse {
    success: boolean
    user?: UserDto
    message?: string
}

export interface IUserService {
    /**
     * Get user by Cognito ID
     * @param cognitoId - The Cognito user ID
     * @returns User information if found
     */
    getUserByCognitoId(cognitoId: string): Promise<GetUserResponse>

    /**
     * Validate if user is active
     * @param cognitoId - The Cognito user ID
     * @returns true if user exists and is active, false otherwise
     */
    isUserActive(cognitoId: string): Promise<boolean>
}

/**
 * Injection token for IUserService
 * Use this token for dependency injection in NestJS
 */
export const USER_SERVICE_TOKEN = Symbol("IUserService")

