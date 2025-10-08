import { Injectable } from "@nestjs/common"
import { DataLoaderFactory } from "./dataloader.factory"

@Injectable()
export class DataLoaderService {
    constructor(private readonly dataLoaderFactory: DataLoaderFactory) {}

    // Organization methods
    async getOrganizationById(organizationId: string) {
        const loader = this.dataLoaderFactory.getOrganizationLoader()
        return loader.load(organizationId)
    }

    async getOrganizationsByIds(organizationIds: string[]) {
        const loader = this.dataLoaderFactory.getOrganizationLoader()
        return loader.loadMany(organizationIds)
    }

    // Organization member methods
    async getOrganizationMembersByUserId(userId: string) {
        const loader = this.dataLoaderFactory.getOrganizationMemberLoader()
        return loader.load(userId)
    }

    async getOrganizationMembersByUserIds(userIds: string[]) {
        const loader = this.dataLoaderFactory.getOrganizationMemberLoader()
        return loader.loadMany(userIds)
    }

    // User organization methods (for Fundraisers)
    async getUserOrganization(userId: string) {
        const loader = this.dataLoaderFactory.getUserOrganizationLoader()
        return loader.load(userId)
    }

    async getUserOrganizations(userIds: string[]) {
        const loader = this.dataLoaderFactory.getUserOrganizationLoader()
        return loader.loadMany(userIds)
    }

    // User methods
    async getUserById(userId: string) {
        const loader = this.dataLoaderFactory.getUserLoader()
        return loader.load(userId)
    }

    async getUsersByIds(userIds: string[]) {
        const loader = this.dataLoaderFactory.getUserLoader()
        return loader.loadMany(userIds)
    }

    // Advanced methods with combined data
    async getFundraiserProfileWithOrganization(userId: string) {
        const [user, organization] = await Promise.all([
            this.getUserById(userId),
            this.getUserOrganization(userId),
        ])

        return {
            user,
            organization,
            profileType: "FUNDRAISER",
        }
    }

    async getKitchenStaffProfileWithOrganization(userId: string) {
        const [user, organizationMembers] = await Promise.all([
            this.getUserById(userId),
            this.getOrganizationMembersByUserId(userId),
        ])

        // Get organization details for the member
        const organizationId = organizationMembers[0]?.organization_id
        const organization = organizationId ? await this.getOrganizationById(organizationId) : null

        return {
            user,
            organizationMembers,
            organization,
            profileType: "KITCHEN_STAFF",
        }
    }

    async getDeliveryStaffProfileWithOrganization(userId: string) {
        const [user, organizationMembers] = await Promise.all([
            this.getUserById(userId),
            this.getOrganizationMembersByUserId(userId),
        ])

        // Get organization details for the member
        const organizationId = organizationMembers[0]?.organization_id
        const organization = organizationId ? await this.getOrganizationById(organizationId) : null

        return {
            user,
            organizationMembers,
            organization,
            profileType: "DELIVERY_STAFF",
        }
    }

    // Cache management methods
    clearOrganizationCache(organizationId: string) {
        this.dataLoaderFactory.clearOrganizationCache(organizationId)
    }

    clearUserOrganizationCache(userId: string) {
        this.dataLoaderFactory.clearUserOrganizationCache(userId)
    }

    clearMemberCache(userId: string) {
        this.dataLoaderFactory.clearMemberCache(userId)
    }

    clearAllCaches() {
        this.dataLoaderFactory.clearAllCaches()
    }
}