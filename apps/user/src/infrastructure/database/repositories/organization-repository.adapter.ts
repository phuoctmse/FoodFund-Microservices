import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import {
    IOrganizationRepository,
    CreateOrganizationData,
    OrganizationQueryOptions,
    PaginationOptions,
} from "../../../domain/interfaces"
import { VerificationStatus, Role } from "../../../domain/enums"

/**
 * Infrastructure Adapter: Organization Repository
 * Implements IOrganizationRepository using Prisma
 */
@Injectable()
export class OrganizationRepositoryAdapter implements IOrganizationRepository {
    private readonly logger = new Logger(OrganizationRepositoryAdapter.name)

    constructor(private readonly prisma: PrismaClient) {}

    /**
     * Create a new organization request
     */
    async createOrganization(
        representativeId: string,
        data: CreateOrganizationData,
    ): Promise<any> {
        const { website, ...organizationData } = data

        return this.prisma.organization.create({
            data: {
                ...organizationData,
                website: website || "",
                representative_id: representativeId,
                status: VerificationStatus.PENDING,
            },
            include: {
                user: true,
            },
        })
    }

    /**
     * Find organization by ID
     */
    async findOrganizationById(id: string): Promise<any | null> {
        return this.prisma.organization.findUnique({
            where: { id },
            include: {
                user: true,
            },
        })
    }

    /**
     * Find organization by representative ID
     */
    async findOrganizationByRepresentativeId(
        representativeId: string,
    ): Promise<any | null> {
        return this.prisma.organization.findFirst({
            where: {
                representative_id: representativeId,
                status: VerificationStatus.VERIFIED,
            },
            include: {
                user: true,
                Organization_Member: {
                    where: {
                        status: VerificationStatus.VERIFIED,
                    },
                    include: {
                        member: true,
                    },
                    orderBy: {
                        joined_at: "desc",
                    },
                },
            },
        })
    }

    /**
     * Find organization with all members
     */
    async findOrganizationWithMembers(id: string): Promise<any | null> {
        return this.prisma.organization.findUnique({
            where: { id },
            include: {
                user: true,
                Organization_Member: {
                    include: {
                        member: true,
                    },
                    orderBy: {
                        joined_at: "desc",
                    },
                },
            },
        })
    }

    /**
     * Update organization status
     */
    async updateOrganizationStatus(
        id: string,
        status: VerificationStatus,
    ): Promise<any> {
        return this.prisma.organization.update({
            where: { id },
            data: { status },
            include: {
                user: true,
            },
        })
    }

    /**
     * Find all pending organizations
     */
    async findPendingOrganizations(): Promise<any[]> {
        return this.prisma.organization.findMany({
            where: {
                status: VerificationStatus.PENDING,
            },
            include: {
                user: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    /**
     * Find all organizations with filters
     */
    async findAllOrganizations(
        options?: OrganizationQueryOptions,
    ): Promise<any[]> {
        const {
            status,
            sortBy = "created_at",
            sortOrder = "desc",
        } = options || {}

        const where: any = {}
        if (status && ["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
            where.status = status as VerificationStatus
        }

        const validSortFields = ["created_at", "name", "status"]
        const validSortOrders = ["asc", "desc"]

        const orderByField = validSortFields.includes(sortBy)
            ? sortBy
            : "created_at"
        const orderByOrder = validSortOrders.includes(sortOrder)
            ? sortOrder
            : "desc"

        return this.prisma.organization.findMany({
            where,
            include: {
                user: true,
            },
            orderBy: {
                [orderByField]: orderByOrder,
            },
        })
    }

    /**
     * Find active organizations with members (paginated)
     */
    async findActiveOrganizationsWithMembersPaginated(options: {
        offset: number
        limit: number
    }): Promise<{ organizations: any[]; total: number }> {
        const total = await this.prisma.organization.count({
            where: {
                status: VerificationStatus.VERIFIED,
            },
        })

        const organizations = await this.prisma.organization.findMany({
            where: {
                status: VerificationStatus.VERIFIED,
            },
            include: {
                user: true,
                Organization_Member: {
                    where: {
                        status: VerificationStatus.VERIFIED,
                    },
                    include: {
                        member: true,
                    },
                    orderBy: {
                        joined_at: "desc",
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            skip: options.offset,
            take: options.limit,
        })

        return {
            organizations,
            total,
        }
    }

    /**
     * Create a join request
     */
    async createJoinRequest(
        userId: string,
        organizationId: string,
        role: Role,
    ): Promise<any> {
        return this.prisma.organization_Member.create({
            data: {
                member_id: userId,
                organization_id: organizationId,
                member_role: role,
                status: VerificationStatus.PENDING,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    /**
     * Find join request by ID
     */
    async findJoinRequestById(id: string): Promise<any | null> {
        return this.prisma.organization_Member.findUnique({
            where: { id },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    /**
     * Find join requests by organization with pagination
     */
    async findJoinRequestsByOrganizationWithPagination(
        organizationId: string,
        options: PaginationOptions,
    ): Promise<{ joinRequests: any[]; total: number }> {
        const whereClause: any = {
            organization_id: organizationId,
        }

        if (options.status) {
            whereClause.status = options.status
        }

        const total = await this.prisma.organization_Member.count({
            where: whereClause,
        })

        const joinRequests = await this.prisma.organization_Member.findMany({
            where: whereClause,
            include: {
                member: true,
                organization: true,
            },
            orderBy: {
                joined_at: "desc",
            },
            skip: options.offset || 0,
            take: options.limit || 10,
        })

        return {
            joinRequests,
            total,
        }
    }

    /**
     * Find all join requests made by a user
     */
    async findMyJoinRequests(userId: string): Promise<any[]> {
        return this.prisma.organization_Member.findMany({
            where: {
                member_id: userId,
            },
            include: {
                member: true,
                organization: true,
            },
            orderBy: {
                joined_at: "desc",
            },
        })
    }

    /**
     * Find pending join request for a user
     */
    async findPendingJoinRequest(userId: string): Promise<any | null> {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                status: VerificationStatus.PENDING,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    /**
     * Find verified membership by user ID
     */
    async findVerifiedMembershipByUserId(userId: string): Promise<any | null> {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                status: VerificationStatus.VERIFIED,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    /**
     * Update join request status
     */
    async updateJoinRequestStatus(
        id: string,
        status: VerificationStatus,
    ): Promise<any> {
        return this.prisma.organization_Member.update({
            where: { id },
            data: { status },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    /**
     * Delete join request
     */
    async deleteJoinRequest(id: string): Promise<void> {
        await this.prisma.organization_Member.delete({
            where: { id },
        })
    }

    /**
     * Check if user has existing join request in any organization
     */
    async checkExistingJoinRequestInAnyOrganization(
        userId: string,
    ): Promise<any | null> {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                OR: [
                    { status: VerificationStatus.PENDING },
                    { status: VerificationStatus.VERIFIED },
                ],
            },
            include: {
                organization: true,
            },
        })
    }
}
