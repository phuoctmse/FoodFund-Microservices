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

@Injectable()
export class PostService {
    private readonly resource = "posts"

    constructor(
        private readonly postRepository: PostRepository,
        private readonly spacesUploadService: SpacesUploadService,
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

        return await this.postRepository.createPost(repositoryInput, userId)
    }

    async getPostsByCampaignId(
        campaignId: string,
        userId: string | null,
        dataLoader: PostLikeDataLoader,
        sortBy: PostSortOrder = PostSortOrder.NEWEST_FIRST,
        limit: number = 10,
        offset: number = 0,
    ) {
        const posts = await this.postRepository.findManyPosts({
            filter: { campaignId },
            sortBy,
            limit: Math.min(limit, 100),
            offset: Math.max(offset, 0),
        })

        const postsWithLikeStatus = await Promise.all(
            posts.map(async (post) => {
                const isLikedByMe = await dataLoader.load({
                    postId: post.id,
                    userId,
                })

                return {
                    ...post,
                    isLikedByMe,
                }
            }),
        )

        return postsWithLikeStatus
    }

    async getPostById(
        id: string,
        userId: string | null,
        dataLoader: PostLikeDataLoader,
    ) {
        const post = await this.postRepository.findPostById(id)

        if (!post) {
            throw new NotFoundException(`Post with ID ${id} not found`)
        }

        const isLikedByMe = await dataLoader.load({
            postId: post.id,
            userId,
        })

        return {
            ...post,
            isLikedByMe,
        }
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

        return await this.postRepository.updatePost(id, repositoryInput, userId)
    }

    async deletePost(id: string, userId: string) {
        const post = await this.postRepository.findPostById(id)
        if (post && post.media) {
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
        return { success: true, message: "Delete successfully" }
    }

    async deactivatePost(id: string, userId: string) {
        return await this.postRepository.deactivatePost(id, userId)
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
