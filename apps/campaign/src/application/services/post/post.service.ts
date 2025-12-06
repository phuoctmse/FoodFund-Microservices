import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { SpacesUploadService } from "@libs/s3-storage/spaces-upload.service"
import { PostRepository } from "../../repositories/post.repository"
import { CreatePostInput, UpdatePostInput } from "../../dtos/post/request"
import { PostLikeDataLoader } from "../../dataloaders"
import { PostSortOrder } from "@app/campaign/src/domain/enums/post/post.enum"
import { PostCacheService } from "./post-cache.service"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { CampaignNewPostEvent } from "@app/campaign/src/domain/events"
import { CampaignRepository } from "../../repositories/campaign.repository"
import { CampaignFollowerService } from "../campaign/campaign-follower.service"
import { stripHtmlTags } from "@app/campaign/src/shared/utils"

@Injectable()
export class PostService {
    private readonly resource = "posts"

    constructor(
        private readonly postRepository: PostRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly postCacheService: PostCacheService,
        private readonly campaignFollowerService: CampaignFollowerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async createPost(data: CreatePostInput, userId: string) {
        if (data.mediaFileKeys && data.mediaFileKeys.length > 0) {
            const validation = await this.spacesUploadService.validateFileKeys(
                data.mediaFileKeys,
                userId,
                this.resource,
            )

            if (!validation.valid) {
                throw new BadRequestException(
                    `Invalid file keys: ${validation.invalidKeys.join(", ")}`,
                )
            }
        }

        const mediaUrls = this.convertFileKeysToCdnUrls(data.mediaFileKeys)

        const repositoryInput = {
            campaignId: data.campaignId,
            title: data.title,
            content: data.content,
            media: mediaUrls ? JSON.stringify(mediaUrls) : undefined,
        }

        const post = await this.postRepository.createPost(
            repositoryInput,
            userId,
        )

        await this.postCacheService.deleteAllPostLists()
        await this.emitNewPostNotification(post.id, data, userId)

        return post
    }

    async getPostsByCampaignId(
        campaignId: string,
        userId: string | null,
        dataLoader: PostLikeDataLoader,
        sortBy: PostSortOrder = PostSortOrder.NEWEST_FIRST,
        limit: number = 10,
        offset: number = 0,
    ) {
        const cacheKey = {
            filter: { campaignId },
            sortBy,
            limit: Math.min(limit, 100),
            offset: Math.max(offset, 0),
        }

        const cachedPosts = await this.postCacheService.getPostList(cacheKey)

        if (cachedPosts && cachedPosts.length > 0) {
            const postsWithLikeStatus = await Promise.all(
                cachedPosts.map(async (post) => {
                    const isLikedByMe = await dataLoader.load({
                        postId: post.id,
                        userId,
                    })

                    const cachedLikeCount = await this.postCacheService.getDistributedLikeCounter(post.id)
                    const likeCount = cachedLikeCount ?? post.likeCount

                    return {
                        ...post,
                        isLikedByMe,
                        likeCount
                    }
                }),
            )

            return postsWithLikeStatus
        }

        const posts = await this.postRepository.findManyPosts({
            filter: { campaignId },
            sortBy,
            limit: Math.min(limit, 100),
            offset: Math.max(offset, 0),
        })

        await this.postCacheService.setPostList(cacheKey, posts)

        const postsWithLikeStatus = await Promise.all(
            posts.map(async (post) => {
                const isLikedByMe = await dataLoader.load({
                    postId: post.id,
                    userId,
                })

                const cachedLikeCount = await this.postCacheService.getDistributedLikeCounter(post.id)
                const likeCount = cachedLikeCount ?? post.likeCount

                return {
                    ...post,
                    isLikedByMe,
                    likeCount,
                }
            }),
        )

        return postsWithLikeStatus
    }

    async updatePost(id: string, data: UpdatePostInput, userId: string) {
        const existingPost = await this.postRepository.findPostById(id)
        if (!existingPost) {
            throw new NotFoundException(`Post with ID ${id} does not exists`)
        }

        if (data.mediaFileKeys && data.mediaFileKeys.length > 0) {
            const validation = await this.spacesUploadService.validateFileKeys(
                data.mediaFileKeys,
                userId,
                this.resource,
            )

            if (!validation.valid) {
                throw new BadRequestException(
                    `Invalid file keys: ${validation.invalidKeys.join(", ")}`,
                )
            }
        }

        if (data.mediaFileKeys && existingPost.media) {
            const oldMediaUrls = JSON.parse(existingPost.media)
            if (Array.isArray(oldMediaUrls)) {
                const oldFileKeys = oldMediaUrls
                    .map((url) =>
                        this.spacesUploadService.extractFileKeyFromUrl(
                            this.resource,
                            url,
                        ),
                    )
                    .filter(Boolean) as string[]

                this.spacesUploadService.deleteBatchFiles(oldFileKeys)
            }
        }

        const mediaUrls = this.convertFileKeysToCdnUrls(data.mediaFileKeys)

        const repositoryInput = {
            title: data.title,
            content: data.content,
            media: mediaUrls ? JSON.stringify(mediaUrls) : undefined,
        }

        const updatedPost = await this.postRepository.updatePost(
            id,
            repositoryInput,
            userId,
        )

        await this.postCacheService.invalidatePost(id)

        return updatedPost
    }

    async deletePost(id: string, userId: string) {
        const post = await this.postRepository.findPostById(id)

        if (!post) {
            throw new NotFoundException(`Post with ID ${id} not found`)
        }

        if (post.media) {
            const mediaUrls = JSON.parse(post.media)
            if (Array.isArray(mediaUrls)) {
                const fileKeys = mediaUrls
                    .map((url) =>
                        this.spacesUploadService.extractFileKeyFromUrl(
                            this.resource,
                            url,
                        ),
                    )
                    .filter(Boolean) as string[]

                this.spacesUploadService.deleteBatchFiles(fileKeys)
            }
        }

        await this.postRepository.deactivatePost(id, userId)
        await this.postCacheService.invalidatePost(id)

        return { success: true, message: "Delete successfully" }
    }

    private async emitNewPostNotification(
        postId: string,
        postData: CreatePostInput,
        authorId: string,
    ): Promise<void> {
        const campaign = await this.campaignRepository.findById(
            postData.campaignId,
        )

        if (!campaign) {
            return
        }

        const campaignFollowerIds =
            await this.campaignFollowerService.getCampaignFollowers(
                postData.campaignId,
            )

        if (campaignFollowerIds.length === 0) {
            return
        }

        const postPreview = this.createPostPreview(postData.content)

        this.eventEmitter.emit("campaign.post.created", {
            postId,
            campaignId: postData.campaignId,
            campaignTitle: campaign.title,
            authorId,
            postTitle: postData.title,
            postPreview,
            followerIds: campaignFollowerIds,
        } satisfies CampaignNewPostEvent)
    }

    private createPostPreview(content: string): string {
        const plainText = stripHtmlTags(content)
        return plainText.length > 100
            ? `${plainText.slice(0, 100)}...`
            : plainText
    }

    private convertFileKeysToCdnUrls(
        fileKeys?: string[],
    ): string[] | undefined {
        if (!fileKeys || fileKeys.length === 0) {
            return undefined
        }

        const cdnEndpoint = process.env.SPACES_CDN_ENDPOINT!

        return fileKeys.map((fileKey) => {
            if (fileKey.startsWith("http")) {
                return fileKey
            }

            return `${cdnEndpoint}/${fileKey}`
        })
    }
}
