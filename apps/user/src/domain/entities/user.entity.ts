import { Role } from "../enums/user.enum"

/**
 * Domain Entity: User
 * Pure business logic, no external dependencies
 */
export class User {
    constructor(
        public readonly id: string,
        public readonly cognitoId: string,
        public readonly email: string,
        public readonly username: string,
        public readonly fullName: string,
        private _isActive: boolean,
        public readonly role: Role,
        public readonly avatarUrl?: string,
        public readonly phoneNumber?: string,
        public readonly bio?: string,
        public readonly address?: string,
        public readonly createdAt?: Date,
        public readonly updatedAt?: Date,
    ) {}

    // ============================================
    // Business Rules
    // ============================================

    /**
     * Check if user can manage organization
     */
    canManageOrganization(): boolean {
        return this.role === Role.FUNDRAISER && this._isActive
    }

    /**
     * Check if user can make donations
     */
    canDonate(): boolean {
        return this.role === Role.DONOR && this._isActive
    }

    /**
     * Check if user is staff member
     */
    isStaff(): boolean {
        return (
            [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF].includes(this.role) &&
            this._isActive
        )
    }

    /**
     * Check if user is admin
     */
    isAdmin(): boolean {
        return this.role === Role.ADMIN && this._isActive
    }

    /**
     * Check if user can perform action
     */
    canPerformAction(): boolean {
        return this._isActive
    }

    // ============================================
    // State Management
    // ============================================

    /**
     * Activate user account
     */
    activate(): void {
        if (this._isActive) {
            throw new Error("User is already active")
        }
        this._isActive = true
    }

    /**
     * Deactivate user account
     */
    deactivate(): void {
        if (!this._isActive) {
            throw new Error("User is already inactive")
        }
        this._isActive = false
    }

    // ============================================
    // Getters
    // ============================================

    get isActive(): boolean {
        return this._isActive
    }

    // ============================================
    // Role Checks
    // ============================================

    hasRole(role: Role): boolean {
        return this.role === role
    }

    hasAnyRole(roles: Role[]): boolean {
        return roles.includes(this.role)
    }
}
