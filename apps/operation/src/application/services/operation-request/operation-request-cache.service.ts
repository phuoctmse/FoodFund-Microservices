import { OperationRequestFilterInput } from "../../dtos"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { OperationRequest } from "@app/operation/src/domain"
import { BaseCacheService } from "@app/operation/src/shared/services"
import { OperationRequestSortOrder } from "@app/operation/src/domain/enums/operation-request"

export interface OperationRequestListCacheKey {
    filter?: OperationRequestFilterInput
}

@Injectable()
export class OperationRequestCacheService extends BaseCacheService<OperationRequest> {
    protected readonly TTL = {
        SINGLE_REQUEST: 60 * 30,
        REQUEST_LIST: 60 * 15,
        USER_REQUESTS: 60 * 30,
        STATS: 60 * 10,
    }

    protected readonly KEYS = {
        SINGLE: "operation-request",
        LIST: "operation-requests:list",
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
        const normalizedParams = this.normalizeListCacheParams(params)
        return this.getList(this.KEYS.LIST, normalizedParams)
    }

    async setRequestList(
        params: OperationRequestListCacheKey,
        requests: OperationRequest[],
    ): Promise<void> {
        const normalizedParams = this.normalizeListCacheParams(params)
        return this.setList(
            this.KEYS.LIST,
            normalizedParams,
            requests,
            this.TTL.REQUEST_LIST,
        )
    }

    async deleteAllRequestLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
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

    async invalidateRequest(requestId: string, userId?: string): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteRequest(requestId),
            this.deleteAllRequestLists(),
            this.deleteRequestStats(),
        ]

        if (userId) {
            operations.push(this.deleteUserRequests(userId))
        }

        return this.invalidateMultiple(...operations)
    }

    async invalidateAll(): Promise<void> {
        return this.invalidateByPatterns(
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
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

    private normalizeListCacheParams(
        params: OperationRequestListCacheKey,
    ): Record<string, any> {
        const normalized = {
            filter: params.filter
                ? {
                    campaignPhaseId: params.filter.campaignPhaseId ?? null,
                    campaignId: params.filter.campaignId ?? null,
                    status: params.filter.status ?? null,
                    expenseType: params.filter.expenseType ?? null,
                    sortBy:
                          params.filter.sortBy ??
                          OperationRequestSortOrder.NEWEST_FIRST,
                    limit: params.filter.limit ?? 10,
                    offset: params.filter.offset ?? 0,
                }
                : null,
        }

        return normalized
    }
}
