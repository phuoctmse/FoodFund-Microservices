/**
 * Domain Entity: User
 * Pure business logic, no external dependencies
 */
export class User {
    constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly username: string,
        public readonly name: string,
        private _isActive: boolean,
        private _emailVerified: boolean,
        public readonly provider: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) {}

    // Business logic methods
    activate(): void {
        if (this._isActive) {
            throw new Error("User is already active")
        }
        this._isActive = true
    }

    deactivate(): void {
        if (!this._isActive) {
            throw new Error("User is already inactive")
        }
        this._isActive = false
    }

    verifyEmail(): void {
        if (this._emailVerified) {
            throw new Error("Email is already verified")
        }
        this._emailVerified = true
    }

    // Getters
    get isActive(): boolean {
        return this._isActive
    }

    get emailVerified(): boolean {
        return this._emailVerified
    }

    // Business rules
    canSignIn(): boolean {
        return this._isActive && this._emailVerified
    }

    canChangePassword(): boolean {
        return this._isActive
    }
}
