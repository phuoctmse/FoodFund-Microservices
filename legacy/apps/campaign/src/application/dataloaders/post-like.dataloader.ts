import { Injectable, Scope } from "@nestjs/common"
import * as DataLoader from "dataloader"
import { PostLikeRepository } from "../repositories/post-like.repository"

export interface PostLikeKey {
    postId: string
    userId: string | null
}

@Injectable({ scope: Scope.REQUEST })
export class PostLikeDataLoader extends DataLoader<
    PostLikeKey,
    boolean,
    string
> {
    constructor(private readonly postLikeRepository: PostLikeRepository) {
        super(async (keys) => this.batchLoadFn(keys), {
            cacheKeyFn: (key: PostLikeKey) =>
                `${key.postId}:${key.userId || "anonymous"}`,
        })
    }

    private async batchLoadFn(
        keys: readonly PostLikeKey[],
    ): Promise<boolean[]> {
        const authenticatedKeys = keys.filter(
            (k) => k.userId !== null,
        ) as Array<{ postId: string; userId: string }>

        if (authenticatedKeys.length === 0) {
            return keys.map(() => false)
        }

        const uniqueUserIds = [
            ...new Set(authenticatedKeys.map((k) => k.userId)),
        ]
        const uniquePostIds = [
            ...new Set(authenticatedKeys.map((k) => k.postId)),
        ]

        const likes = await this.postLikeRepository.findLikesByUsersAndPosts(
            uniqueUserIds,
            uniquePostIds,
        )

        const likedMap = new Map<string, boolean>()
        likes.forEach((like) => {
            const cacheKey = `${like.postId}:${like.userId}`
            likedMap.set(cacheKey, true)
        })

        const results = keys.map((key) => {
            if (!key.userId) return false
            const cacheKey = `${key.postId}:${key.userId}`
            return likedMap.get(cacheKey) || false
        })

        return results
    }
}
