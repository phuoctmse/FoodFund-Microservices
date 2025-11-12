import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateOrganizationInput } from "@app/user/src/application/dtos"
import { Role, VerificationStatus } from "../../enums"

@Injectable()
export class OrganizationRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createOrganization(cognitoId: string, data: CreateOrganizationInput) {
        const { website, ...organizationData } = data
        return this.prisma.organization.create({
            data: {
                ...organizationData,
                website: website || "",
                representative_id: cognitoId,
                status: VerificationStatus.PENDING,
            },
            include: {
                user: true,
            },
        })
    }

    async findPendingOrganizations() {
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

    async findAllOrganizations(options?: {
        status?: string
        sortBy?: string
        sortOrder?: string
    }) {
        const {
            status,
            sortBy = "created_at",
            sortOrder = "desc",
        } = options || {}

        // Build where clause
        const where: any = {}
        if (status && ["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
            where.status = status as VerificationStatus
        }

        // Build orderBy clause
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

    async updateOrganizationStatus(
        id: string,
        status: VerificationStatus,
        reason?: string,
    ) {
        return this.prisma.organization.update({
            where: { id },
            data: {
                status,
                reason: reason || null,
            },
            include: {
                user: true,
            },
        })
    }

    async findOrganizationById(id: string) {
        return this.prisma.organization.findUnique({
            where: { id },
            include: {
                user: true,
            },
        })
    }

    async findOrganizationWithMembers(id: string) {
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

    async findOrganizationByRepresentativeId(representativeId: string) {
        return this.prisma.organization.findFirst({
            where: {
                representative_id: representativeId,
                status: VerificationStatus.VERIFIED, // Only get active organization
            },
            include: {
                user: true,
                Organization_Member: {
                    where: {
                        status: VerificationStatus.VERIFIED, // Only get verified members
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

    async createJoinRequest(
        userId: string,
        organizationId: string,
        requestedRole: Role,
    ) {
        return this.prisma.organization_Member.create({
            data: {
                member_id: userId,
                organization_id: organizationId,
                member_role: requestedRole,
                status: VerificationStatus.PENDING,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async createVerifiedMember(
        userId: string,
        organizationId: string,
        memberRole: Role,
    ) {
        return this.prisma.organization_Member.create({
            data: {
                member_id: userId,
                organization_id: organizationId,
                member_role: memberRole,
                status: VerificationStatus.VERIFIED,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async findPendingJoinRequestsByOrganization(organizationId: string) {
        return this.prisma.organization_Member.findMany({
            where: {
                organization_id: organizationId,
                status: VerificationStatus.PENDING,
            },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async findJoinRequestsByOrganizationWithPagination(
        organizationId: string,
        options: { offset: number; limit: number; status?: string },
    ) {
        const whereClause: any = {
            organization_id: organizationId,
        }

        // Add status filter if provided
        if (options.status) {
            whereClause.status = options.status
        }

        // Get total count
        const total = await this.prisma.organization_Member.count({
            where: whereClause,
        })

        // Get paginated results
        const joinRequests = await this.prisma.organization_Member.findMany({
            where: whereClause,
            include: {
                member: true,
                organization: true,
            },
            orderBy: {
                joined_at: "desc", // Most recent first
            },
            skip: options.offset,
            take: options.limit,
        })

        return {
            joinRequests,
            total,
        }
    }

    async findPendingJoinRequest(userId: string) {
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

    async findJoinRequestById(requestId: string) {
        return this.prisma.organization_Member.findUnique({
            where: { id: requestId },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async updateJoinRequestStatus(
        requestId: string,
        status: VerificationStatus,
    ) {
        return this.prisma.organization_Member.update({
            where: { id: requestId },
            data: { status },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async deleteJoinRequest(requestId: string) {
        return this.prisma.organization_Member.delete({
            where: { id: requestId },
            include: {
                member: true,
                organization: true,
            },
        })
    }

    async checkExistingJoinRequest(userId: string, organizationId: string) {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                organization_id: organizationId,
            },
        })
    }

    async checkExistingJoinRequestInAnyOrganization(userId: string) {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                // Check for both pending requests and active memberships
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

    async findUserActiveOrganizationMember(userId: string) {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                status: VerificationStatus.VERIFIED,
            },
            include: {
                organization: true,
            },
        })
    }

    // DataLoader optimized methods
    async findOrganizationsByIds(organizationIds: string[]) {
        const organizations = await this.prisma.organization.findMany({
            where: {
                id: { in: organizationIds },
            },
            include: {
                user: true,
                Organization_Member: {
                    include: {
                        member: true,
                    },
                },
            },
        })

        // Ensure ordering matches input ids
        return organizationIds
            .map((id) => organizations.find((org) => org.id === id))
            .filter(Boolean)
    }

    async findOrganizationMembersByUserIds(userIds: string[]) {
        const members = await this.prisma.organization_Member.findMany({
            where: {
                member_id: { in: userIds },
                status: VerificationStatus.VERIFIED,
            },
            include: {
                organization: true,
                member: true,
            },
        })

        // Group by user_id to maintain order (each user can have multiple memberships)
        const memberMap = new Map<string, any[]>()
        members.forEach((member) => {
            const existing = memberMap.get(member.member_id) || []
            existing.push(member)
            memberMap.set(member.member_id, existing)
        })

        // Return flattened array in order
        return userIds.flatMap((id) => memberMap.get(id) || [])
    }

    async findOrganizationsByRepresentativeIds(userIds: string[]) {
        const organizations = await this.prisma.organization.findMany({
            where: {
                representative_id: { in: userIds },
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
                },
            },
        })

        // Group by representative_id to maintain order
        const orgMap = new Map<string, any>()
        organizations.forEach((org) => {
            orgMap.set(org.representative_id, org)
        })

        return userIds.map((id) => orgMap.get(id)).filter(Boolean)
    }

    async findActiveOrganizationsWithMembersPaginated(options: {
        offset: number
        limit: number
    }) {
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
                created_at: "desc", // Most recent organizations first
            },
            skip: options.offset,
            take: options.limit,
        })

        return {
            organizations,
            total,
        }
    }

    async findMyJoinRequests(userId: string) {
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

    async findVerifiedMembershipByUserId(userId: string) {
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

    async findMembersByOrganizationId(organizationId: string) {
        return await this.prisma.organization_Member.findMany({
            where: {
                organization_id: organizationId,
            },
            include: {
                member: {
                    select: {
                        id: true,
                        cognito_id: true,
                        email: true,
                        full_name: true,
                        role: true,
                    },
                },
            },
        })
    }

    async findOrganizationBasicInfoByRepresentativeId(
        representativeId: string,
    ): Promise<{
        id: string
        name: string
    } | null> {
        return this.prisma.organization.findFirst({
            where: {
                representative_id: representativeId,
                status: VerificationStatus.VERIFIED,
            },
            select: {
                id: true,
                name: true,
            },
        })
    }

    async findMemberOrganizationBasicInfo(userId: string): Promise<{
        organization: {
            id: string
            name: string
        }
    } | null> {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                status: VerificationStatus.VERIFIED,
            },
            select: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })
    }

    /**
     * Cancel organization request by updating status to CANCELLED
     * Used when user wants to cancel their organization creation request
     */
    async cancelOrganizationRequest(organizationId: string, reason?: string) {
        return this.prisma.organization.update({
            where: { id: organizationId },
            data: {
                status: VerificationStatus.CANCELLED,
                reason: reason || "Cancelled by user",
            },
            include: {
                user: true,
            },
        })
    }
}