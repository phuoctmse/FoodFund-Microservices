import { OperationRequestFilterInput } from "../../dtos"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { OperationRequest } from "@app/operation/src/domain"
import { BaseCacheService } from "@app/operation/src/shared/services"

export interface OperationRequestListCacheKey {
    filter?: OperationRequestFilterInput
}

@Injectable()
export class OperationRequestCacheService extends BaseCacheService<OperationRequest> {
    protected readonly TTL = {
        SINGLE_REQUEST: 60 * 30,
        REQUEST_LIST: 60 * 15,
        PHASE_REQUESTS: 60 * 30,
        CAMPAIGN_REQUESTS: 60 * 30,
        USER_REQUESTS: 60 * 30,
        STATS: 60 * 10,
    }

    protected readonly KEYS = {
        SINGLE: "operation-request",
        LIST: "operation-requests:list",
        PHASE: "operation-requests:phase",
        CAMPAIGN: "operation-requests:campaign",
        USER: "operation-requests:user",
        STATS: "operation-requests:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Operation Request ====================

    async getRequest(id: string): Promise<OperationRequest | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setRequest(id: string, request: OperationRequest): Promise<void> {
        return this.setSingle(
            this.KEYS.SINGLE,
            id,
            request,
            this.TTL.SINGLE_REQUEST,
        )
    }

    async deleteRequest(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Request Lists ====================

    async getRequestList(
        params: OperationRequestListCacheKey,
    ): Promise<OperationRequest[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setRequestList(
        params: OperationRequestListCacheKey,
        requests: OperationRequest[],
    ): Promise<void> {
        return this.setList(
            this.KEYS.LIST,
            params,
            requests,
            this.TTL.REQUEST_LIST,
        )
    }

    async deleteAllRequestLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== Campaign Phase Requests ====================

    async getPhaseRequests(
        campaignPhaseId: string,
    ): Promise<OperationRequest[] | null> {
        return this.getRelatedList(this.KEYS.PHASE, campaignPhaseId)
    }

    async setPhaseRequests(
        campaignPhaseId: string,
        requests: OperationRequest[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.PHASE,
            campaignPhaseId,
            requests,
            this.TTL.PHASE_REQUESTS,
        )
    }

    async deletePhaseRequests(campaignPhaseId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.PHASE, campaignPhaseId)
    }

    // ==================== Campaign Requests ====================

    async getCampaignRequests(
        campaignId: string,
    ): Promise<OperationRequest[] | null> {
        return this.getRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    async setCampaignRequests(
        campaignId: string,
        requests: OperationRequest[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.CAMPAIGN,
            campaignId,
            requests,
            this.TTL.CAMPAIGN_REQUESTS,
        )
    }

    async deleteCampaignRequests(campaignId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    // ==================== User Requests ====================

    async getUserRequests(
        userId: string,
        limit: number,
        offset: number,
    ): Promise<OperationRequest[] | null> {
        return this.getRelatedList(this.KEYS.USER, userId, limit, offset)
    }

    async setUserRequests(
        userId: string,
        limit: number,
        offset: number,
        requests: OperationRequest[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.USER,
            userId,
            requests,
            this.TTL.USER_REQUESTS,
            limit,
            offset,
        )
    }

    async deleteUserRequests(userId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.USER, userId)
    }

    // ==================== Statistics ====================

    async getRequestStats(): Promise<{
        totalRequests: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    } | null> {
        return this.getStats(this.KEYS.STATS)
    }

    async setRequestStats(stats: {
        totalRequests: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    }): Promise<void> {
        return this.setStats(this.KEYS.STATS, stats, this.TTL.STATS)
    }

    async deleteRequestStats(): Promise<void> {
        return this.deleteStats(this.KEYS.STATS)
    }

    // ==================== Invalidation ====================

    async invalidateRequest(
        requestId: string,
        campaignPhaseId?: string,
        userId?: string,
    ): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteRequest(requestId),
            this.deleteAllRequestLists(),
            this.deleteRequestStats(),
        ]

        if (campaignPhaseId) {
            operations.push(this.deletePhaseRequests(campaignPhaseId))
        }

        if (userId) {
            operations.push(this.deleteUserRequests(userId))
        }

        return this.invalidateMultiple(...operations)
    }

    async invalidateAll(): Promise<void> {
        return this.invalidateByPatterns(
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.PHASE}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.USER}:*`,
            `${this.KEYS.STATS}:*`,
        )
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("operation-request*")
    }
}