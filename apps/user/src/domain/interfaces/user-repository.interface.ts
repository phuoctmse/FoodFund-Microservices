import { User } from "../entities/user.entity"
import { Role } from "../enums/user.enum"

/**
 * Domain Interface: User Repository
 * Defines contract for user data access
 */
export interface IUserRepository {
    // Create
    create(user: Partial<User>): Promise<User>

    // Read
    findById(id: string): Promise<User | null>
    findByCognitoId(cognitoId: string): Promise<User | null>
    findByEmail(email: string): Promise<User | null>
    findByUsername(username: string): Promise<User | null>
    findAll(skip?: number, take?: number): Promise<User[]>
    findByIds(ids: string[]): Promise<User[]>

    // Update
    update(id: string, data: Partial<User>): Promise<User>
    updateRole(id: string, role: Role): Promise<User>

    // Delete
    delete(id: string): Promise<User>

    // Business queries
    findActiveUsers(): Promise<User[]>
    findUsersByRole(role: Role): Promise<User[]>
}
