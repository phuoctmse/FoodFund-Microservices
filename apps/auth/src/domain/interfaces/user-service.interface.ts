/**
 * Domain Interface: User Service
 * Defines contract for User Service communication
 */
export interface IUserService {
    createUser(data: {
        cognitoId: string
        email: string
        username: string
        fullName: string
        role: string
    }): Promise<{ success: boolean; error?: string }>

    getUser(cognitoId: string): Promise<{
        success: boolean
        user?: {
            id: string
            email: string
            isActive: boolean
        }
        error?: string
    }>

    updateUser(
        cognitoId: string,
        data: Record<string, any>,
    ): Promise<{ success: boolean }>

    deleteUser(cognitoId: string): Promise<{ success: boolean }>
}
