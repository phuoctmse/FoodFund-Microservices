import DataLoader from "dataloader"
import { Injectable, Scope } from "@nestjs/common"
import { OrganizationRepository } from "../../repositories/organization/organization.repository"
import { UserRepository } from "../../repositories/user.repository"

@Injectable({ scope: Scope.REQUEST }) // Per-request instance
export class DataLoaderFactory {
    private organizationLoader?: DataLoader<string, any>
    private organizationMemberLoader?: DataLoader<string, any[]>
    private userOrganizationLoader?: DataLoader<string, any>
    private userLoader?: DataLoader<string, any>

    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly userRepository: UserRepository,
    ) {}

    // Organization by ID DataLoader
    getOrganizationLoader(): DataLoader<string, any> {
        if (!this.organizationLoader) {
            this.organizationLoader = new DataLoader(
                async (organizationIds: readonly string[]) => {
                    const organizations = await this.organizationRepository.findOrganizationsByIds(
                        organizationIds as string[],
                    )
                    
                    return organizationIds.map(id => 
                        organizations.find(org => org?.id === id) || null
                    )
                },
                {
                    // Options
                    cache: true,
                    maxBatchSize: 100,
                    batchScheduleFn: callback => setTimeout(callback, 1), // Batch delay 1ms
                }
            )
        }
        return this.organizationLoader
    }

    // Organization Members by User ID DataLoader
    getOrganizationMemberLoader(): DataLoader<string, any[]> {
        if (!this.organizationMemberLoader) {
            this.organizationMemberLoader = new DataLoader(
                async (userIds: readonly string[]) => {
                    const members = await this.organizationRepository.findOrganizationMembersByUserIds(
                        userIds as string[],
                    )
                    
                    return userIds.map(userId => 
                        members.filter(member => member.member_id === userId)
                    )
                }
            )
        }
        return this.organizationMemberLoader
    }

    // User's Organization (for Fundraisers) DataLoader
    getUserOrganizationLoader(): DataLoader<string, any> {
        if (!this.userOrganizationLoader) {
            this.userOrganizationLoader = new DataLoader(
                async (userIds: readonly string[]) => {
                    const organizations = await this.organizationRepository.findOrganizationsByRepresentativeIds(
                        userIds as string[],
                    )
                    
                    return userIds.map(userId => 
                        organizations.find(org => org.representative_id === userId) || null
                    )
                }
            )
        }
        return this.userOrganizationLoader
    }

    // User by ID DataLoader
    getUserLoader(): DataLoader<string, any> {
        if (!this.userLoader) {
            this.userLoader = new DataLoader(
                async (userIds: readonly string[]) => {
                    const users = await this.userRepository.findUsersByIds(
                        userIds as string[],
                    )
                    
                    return userIds.map(userId => 
                        users.find(user => user.id === userId) || null
                    )
                }
            )
        }
        return this.userLoader
    }

    // Clear specific cache
    clearOrganizationCache(organizationId: string) {
        this.organizationLoader?.clear(organizationId)
    }

    clearUserOrganizationCache(userId: string) {
        this.userOrganizationLoader?.clear(userId)
    }

    clearMemberCache(userId: string) {
        this.organizationMemberLoader?.clear(userId)
    }

    // Clear all caches
    clearAllCaches() {
        this.organizationLoader?.clearAll()
        this.organizationMemberLoader?.clearAll()
        this.userOrganizationLoader?.clearAll()
        this.userLoader?.clearAll()
    }
}