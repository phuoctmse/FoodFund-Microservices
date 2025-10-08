import { Injectable } from "@nestjs/common"
import {
    PrismaClient,
    Verification_Status,
    Role,
} from "../../../generated/user-client"
import { CreateOrganizationInput } from "../../dto/organization.input"

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
                status: Verification_Status.PENDING,
            },
            include: {
                user: true,
            },
        })
    }

    async findPendingOrganizations() {
        return this.prisma.organization.findMany({
            where: {
                status: Verification_Status.PENDING,
            },
            include: {
                user: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    async updateOrganizationStatus(id: string, status: Verification_Status) {
        return this.prisma.organization.update({
            where: { id },
            data: { status },
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
                status: Verification_Status.PENDING,
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
                status: Verification_Status.VERIFIED,
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
                status: Verification_Status.PENDING,
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
        status: Verification_Status,
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

    async checkExistingJoinRequest(userId: string, organizationId: string) {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                organization_id: organizationId,
            },
        })
    }

    async findUserActiveOrganizationMembership(userId: string) {
        return this.prisma.organization_Member.findFirst({
            where: {
                member_id: userId,
                status: Verification_Status.VERIFIED,
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
        return organizationIds.map(id => organizations.find(org => org.id === id)).filter(Boolean)
    }

    async findOrganizationMembersByUserIds(userIds: string[]) {
        const members = await this.prisma.organization_Member.findMany({
            where: {
                member_id: { in: userIds },
                status: Verification_Status.VERIFIED,
            },
            include: {
                organization: true,
                member: true,
            },
        })
        
        // Group by user_id to maintain order (each user can have multiple memberships)
        const memberMap = new Map<string, any[]>()
        members.forEach(member => {
            const existing = memberMap.get(member.member_id) || []
            existing.push(member)
            memberMap.set(member.member_id, existing)
        })
        
        // Return flattened array in order
        return userIds.flatMap(id => memberMap.get(id) || [])
    }

    async findOrganizationsByRepresentativeIds(userIds: string[]) {
        const organizations = await this.prisma.organization.findMany({
            where: {
                representative_id: { in: userIds },
                status: Verification_Status.VERIFIED,
            },
            include: {
                user: true,
                Organization_Member: {
                    where: {
                        status: Verification_Status.VERIFIED,
                    },
                    include: {
                        member: true,
                    },
                },
            },
        })
        
        // Group by representative_id to maintain order
        const orgMap = new Map<string, any>()
        organizations.forEach(org => {
            orgMap.set(org.representative_id, org)
        })
        
        return userIds.map(id => orgMap.get(id)).filter(Boolean)
    }
}
