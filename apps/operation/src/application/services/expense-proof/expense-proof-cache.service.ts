import { Injectable } from "@nestjs/common"
import { ExpenseProofFilterInput } from "../../dtos"
import { RedisService } from "@libs/redis"
import { ExpenseProof } from "@app/operation/src/domain"
import { createHash } from "crypto"

export interface ExpenseProofListCacheKey {
    filter?: ExpenseProofFilterInput
    limit: number
    offset: number
}

@Injectable()
export class ExpenseProofCacheService {
    private readonly TTL = {
        SINGLE_PROOF: 60 * 30, // 30 minutes
        PROOF_LIST: 60 * 15, // 15 minutes
        REQUEST_PROOFS: 60 * 30, // 30 minutes
        PHASE_PROOFS: 60 * 30, // 30 minutes
        CAMPAIGN_PROOFS: 60 * 30, // 30 minutes
        ORGANIZATION_PROOFS: 60 * 30, // 30 minutes
        STATS: 60 * 10, // 10 minutes
    }

    private readonly KEYS = {
        SINGLE: "expense-proof",
        LIST: "expense-proofs:list",
        REQUEST: "expense-proofs:request",
        PHASE: "expense-proofs:phase",
        CAMPAIGN: "expense-proofs:campaign",
        ORGANIZATION: "expense-proofs:organization",
        STATS: "expense-proofs:stats",
    }

    constructor(private readonly redis: RedisService) {}

    // ==================== Single Expense Proof ====================

    async getProof(id: string): Promise<ExpenseProof | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof
        }

        return null
    }

    async setProof(id: string, proof: ExpenseProof): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(proof), {
            ex: this.TTL.SINGLE_PROOF,
        })
    }

    async deleteProof(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    // ==================== Proof Lists ====================

    private generateListCacheKey(params: ExpenseProofListCacheKey): string {
        const normalized = {
            filter: params.filter || {},
            limit: params.limit,
            offset: params.offset,
        }

        const hash = createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex")
            .substring(0, 16)

        return `${this.KEYS.LIST}:${hash}`
    }

    async getProofList(
        params: ExpenseProofListCacheKey,
    ): Promise<ExpenseProof[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof[]
        }

        return null
    }

    async setProofList(
        params: ExpenseProofListCacheKey,
        proofs: ExpenseProof[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(proofs), {
            ex: this.TTL.PROOF_LIST,
        })
    }

    async deleteAllProofLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Ingredient Request Proofs ====================

    async getRequestProofs(requestId: string): Promise<ExpenseProof[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.REQUEST}:${requestId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof[]
        }

        return null
    }

    async setRequestProofs(
        requestId: string,
        proofs: ExpenseProof[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.REQUEST}:${requestId}`
        await this.redis.set(key, JSON.stringify(proofs), {
            ex: this.TTL.REQUEST_PROOFS,
        })
    }

    async deleteRequestProofs(requestId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.REQUEST}:${requestId}`
        await this.redis.del(key)
    }

    // ==================== Campaign Phase Proofs ====================

    async getPhaseProofs(
        campaignPhaseId: string,
        limit: number,
        offset: number,
    ): Promise<ExpenseProof[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof[]
        }

        return null
    }

    async setPhaseProofs(
        campaignPhaseId: string,
        limit: number,
        offset: number,
        proofs: ExpenseProof[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(proofs), {
            ex: this.TTL.PHASE_PROOFS,
        })
    }

    async deletePhaseProofs(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.PHASE}:${campaignPhaseId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Proofs ====================

    async getCampaignProofs(
        campaignId: string,
        limit: number,
        offset: number,
    ): Promise<ExpenseProof[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof[]
        }

        return null
    }

    async setCampaignProofs(
        campaignId: string,
        limit: number,
        offset: number,
        proofs: ExpenseProof[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(proofs), {
            ex: this.TTL.CAMPAIGN_PROOFS,
        })
    }

    async deleteCampaignProofs(campaignId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.CAMPAIGN}:${campaignId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Organization Proofs ====================

    async getOrganizationProofs(
        userId: string,
        requestId?: string,
    ): Promise<ExpenseProof[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = requestId
            ? `${this.KEYS.ORGANIZATION}:${userId}:${requestId}`
            : `${this.KEYS.ORGANIZATION}:${userId}:all`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as ExpenseProof[]
        }

        return null
    }

    async setOrganizationProofs(
        userId: string,
        proofs: ExpenseProof[],
        requestId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = requestId
            ? `${this.KEYS.ORGANIZATION}:${userId}:${requestId}`
            : `${this.KEYS.ORGANIZATION}:${userId}:all`
        await this.redis.set(key, JSON.stringify(proofs), {
            ex: this.TTL.ORGANIZATION_PROOFS,
        })
    }

    async deleteOrganizationProofs(userId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.ORGANIZATION}:${userId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Statistics ====================

    async getStats(): Promise<{
        totalProofs: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    } | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.STATS}:global`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached)
        }

        return null
    }

    async setStats(stats: {
        totalProofs: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    }): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:global`
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.STATS,
        })
    }

    async deleteStats(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:global`
        await this.redis.del(key)
    }

    // ==================== Invalidation ====================

    async invalidateProof(
        proofId: string,
        requestId?: string,
        campaignPhaseId?: string,
        organizationUserId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deleteProof(proofId),
            this.deleteAllProofLists(),
            this.deleteStats(),
        ]

        if (requestId) {
            deleteOperations.push(this.deleteRequestProofs(requestId))
        }

        if (campaignPhaseId) {
            deleteOperations.push(this.deletePhaseProofs(campaignPhaseId))
        }

        if (organizationUserId) {
            deleteOperations.push(
                this.deleteOrganizationProofs(organizationUserId),
            )
        }

        await Promise.all(deleteOperations)
    }

    async invalidateAll(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const patterns = [
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.REQUEST}:*`,
            `${this.KEYS.PHASE}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.ORGANIZATION}:*`,
            `${this.KEYS.STATS}:*`,
        ]

        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern)
            if (keys.length > 0) {
                await this.redis.del(keys)
            }
        }
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        const isAvailable = this.redis.isAvailable()

        if (!isAvailable) {
            return { available: false, keysCount: 0 }
        }

        const keys = await this.redis.keys("expense-proof*")
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}