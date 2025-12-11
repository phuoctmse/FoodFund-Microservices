import { Injectable } from "@nestjs/common"
import { ExpenseProofFilterInput } from "../../dtos"
import { RedisService } from "@libs/redis"
import { ExpenseProof } from "@app/operation/src/domain"
import { BaseCacheService } from "@app/operation/src/shared/services"

export interface ExpenseProofListCacheKey {
    filter?: ExpenseProofFilterInput
}

@Injectable()
export class ExpenseProofCacheService extends BaseCacheService<ExpenseProof> {
    protected readonly TTL = {
        SINGLE_PROOF: 60 * 30, // 30 minutes
        PROOF_LIST: 60 * 15, // 15 minutes
        ORGANIZATION_PROOFS: 60 * 30, // 30 minutes
        STATS: 60 * 10, // 10 minutes
    }

    protected readonly KEYS = {
        SINGLE: "expense-proof",
        LIST: "expense-proofs:list",
        ORGANIZATION: "expense-proofs:organization",
        STATS: "expense-proofs:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Proof ====================

    async getProof(id: string): Promise<ExpenseProof | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setProof(id: string, proof: ExpenseProof): Promise<void> {
        return this.setSingle(
            this.KEYS.SINGLE,
            id,
            proof,
            this.TTL.SINGLE_PROOF,
        )
    }

    async deleteProof(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Proof Lists ====================

    async getProofList(
        params: ExpenseProofListCacheKey,
    ): Promise<ExpenseProof[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setProofList(
        params: ExpenseProofListCacheKey,
        proofs: ExpenseProof[],
    ): Promise<void> {
        return this.setList(this.KEYS.LIST, params, proofs, this.TTL.PROOF_LIST)
    }

    async deleteAllProofLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== Organization Proofs ====================

    async getOrganizationProofs(
        organizationId: string,
    ): Promise<ExpenseProof[] | null> {
        return this.getRelatedList(this.KEYS.ORGANIZATION, organizationId)
    }

    async setOrganizationProofs(
        organizationId: string,
        proofs: ExpenseProof[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.ORGANIZATION,
            organizationId,
            proofs,
            this.TTL.ORGANIZATION_PROOFS,
        )
    }

    async deleteOrganizationProofs(organizationId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.ORGANIZATION, organizationId)
    }

    // ==================== Statistics ====================

    async getProofStats(): Promise<{
        totalProofs: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    } | null> {
        return this.getStats(this.KEYS.STATS)
    }

    async setProofStats(stats: {
        totalProofs: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    }): Promise<void> {
        return this.setStats(this.KEYS.STATS, stats, this.TTL.STATS)
    }

    async deleteProofStats(): Promise<void> {
        return this.deleteStats(this.KEYS.STATS)
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("expense-proof*")
    }
}
