import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { CreatePostInput, UpdatePostInput } from "../dtos/request"
import { PostRepository } from "../repositories/post.repository"
import { SpacesUploadService } from "@libs/s3-storage/spaces-upload.service"
import { PostLikeDataLoader } from "../dataloaders/post-like.dataloader"

@Injectable()
export class PostService {
    private readonly logger = new Logger(PostService.name)
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

    async getPostByCampaignId(
        campaignId: string,
        userId: string | null,
        dataLoader: PostLikeDataLoader,
    ) {
        const posts = await this.postRepository.findManyPosts({
            filter: { campaignId },
            sortBy: undefined,
            limit: 1,
            offset: 0,
        })

        if (posts.length === 0) {
            throw new NotFoundException(
                `Not found post with campaign ${campaignId}`,
            )
        }

        const post = posts[0]
        const isLikedByMe = await dataLoader.load({
            postId: post.id,
            userId,
        })

        return {
            ...post,
            isLikedByMe,
        }
    }

    async getPostById(id: string) {
        const post = await this.postRepository.findPostById(id)
        if (!post) {
            throw new NotFoundException(`Post with ID ${id} does not exists`)
        }
        return post
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
            try {
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

                    this.spacesUploadService
                        .deleteBatchFiles(oldFileKeys)
                        .catch((error) => {
                            this.logger.error(
                                "Failed to cleanup old media:",
                                error,
                            )
                        })
                }
            } catch (error) {
                this.logger.warn(
                    "Failed to parse old media for cleanup:",
                    error,
                )
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
            try {
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

                    this.spacesUploadService
                        .deleteBatchFiles(fileKeys)
                        .catch((error) => {
                            this.logger.error("Failed to cleanup media:", error)
                        })
                }
            } catch (error) {
                this.logger.warn("Failed to parse media for cleanup:", error)
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
