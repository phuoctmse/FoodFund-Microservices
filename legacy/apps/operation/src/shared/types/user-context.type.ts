export enum Role {
    DONOR = "DONOR",
    FUNDRAISER = "FUNDRAISER",
    KITCHEN_STAFF = "KITCHEN_STAFF",
    DELIVERY_STAFF = "DELIVERY_STAFF",
    ADMIN = "ADMIN",
}

export interface UserContext {
    userId: string
    role?: Role
    username?: string
    tokenMetadata?: {
        iss: string
        clientId: string
        tokenUse: string
        scope: string
        authTime: number
        exp: number
        iat: number
    }
}

export function createUserContextFromToken(decodedToken: any): UserContext {
    const roleValue =
        decodedToken["custom:role"] ||
        decodedToken.role ||
        decodedToken["cognito:groups"]?.[0]
    let parsedRole: Role | undefined = undefined
    if (roleValue) {
        const upperRole = String(roleValue).toUpperCase()
        if (Object.values(Role).includes(upperRole as Role)) {
            parsedRole = upperRole as Role
        }
    }

    return {
        userId: decodedToken.sub,
        username: decodedToken.username,
        role: parsedRole,
        tokenMetadata: {
            iss: decodedToken.iss,
            clientId: decodedToken.client_id,
            tokenUse: decodedToken.token_use,
            scope: decodedToken.scope,
            authTime: decodedToken.auth_time,
            exp: decodedToken.exp,
            iat: decodedToken.iat,
        },
    }
}
