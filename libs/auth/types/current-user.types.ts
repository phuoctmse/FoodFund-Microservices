export interface CurrentUserType {
    roles: string[]
    attributes: {
        role: string
    }
    id: string
    cognito_id: string
    email: string
    username: string
    name: string
    provider: string
    sub?: string // Cognito ID alias (some contexts use this instead of cognito_id)
}

export interface AuthenticatedUser extends CurrentUserType {
    // Add any additional fields that might be present
}